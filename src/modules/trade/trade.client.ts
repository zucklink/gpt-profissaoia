import { fileSave } from 'browser-fs-access';

import { defaultSystemPurposeId, SystemPurposeId, SystemPurposes } from '../../data';

import { DModelSource, useModelsStore } from '~/modules/llms/store-llms';

import { Brand } from '~/common/app.config';
import { DFolder, useFolderStore } from '~/common/state/store-folders';
import { capitalizeFirstLetter } from '~/common/util/textUtils';
import { conversationTitle, DConversation, type DConversationId, DMessage, useChatStore } from '~/common/state/store-chats';
import { prettyBaseModel } from '~/common/util/modelUtils';

import { ImportedOutcome } from './ImportOutcomeModal';

import { jsPDF, RGBAData } from 'jspdf';


/// IMPORT ///

/**
 * Restores all conversations in a JSON
 *  - supports both ExportedConversationJsonV1, and ExportedAllJsonV1 files
 */
export function loadAllConversationsFromJson(fileName: string, obj: any, outcome: ImportedOutcome) {
  // heuristics
  const hasConversations = obj.hasOwnProperty('conversations');
  const hasMessages = obj.hasOwnProperty('messages');

  // parse ExportedAllJsonV1
  if (hasConversations && !hasMessages) {
    const { conversations, folders } = obj as ExportedAllJsonV1b;
    for (const conversation of conversations)
      pushOutcomeFromJsonV1(fileName, conversation, outcome);
    // in ExportedAllJsonV1b+, folders weren't there before
    if (folders?.folders) {
      const dFolders = folders.folders.map(createFolderFromJsonV1).filter(Boolean) as DFolder[];
      useFolderStore.getState().importFoldersAppend(dFolders, folders.enableFolders);
    }
  }
  // parse ExportedConversationJsonV1
  else if (hasMessages && !hasConversations) {
    pushOutcomeFromJsonV1(fileName, obj as ExportedConversationJsonV1, outcome);
  }
  // invalid
  else {
    outcome.conversations.push({ success: false, fileName, error: `Invalid file: ${fileName}` });
  }
}

// NOTE: the tokenCount was removed while still in the JsonV1 format, so here we add it back, for backwards compat
export function createConversationFromJsonV1(part: ExportedConversationJsonV1 & { tokenCount?: number }) {
  if (!part || !part.id || !part.messages) {
    console.warn('createConversationFromJsonV1: invalid conversation json', part);
    return null;
  }
  const restored: DConversation = {
    id: part.id,
    messages: part.messages,
    systemPurposeId: part.systemPurposeId || defaultSystemPurposeId,
    ...(part.userTitle && { userTitle: part.userTitle }),
    ...(part.autoTitle && { autoTitle: part.autoTitle }),
    tokenCount: part.tokenCount || 0,
    created: part.created || Date.now(),
    updated: part.updated || Date.now(),
    // add these back - these fields are not exported
    abortController: null,
  };
  return restored;
}

function createFolderFromJsonV1(part: ExportedFolderJsonV1) {
  if (!part || !part.id || !part.title || !part.conversationIds) {
    console.warn('createFolderFromJsonV1: invalid folder json', part);
    return null;
  }
  const restored: DFolder = {
    id: part.id,
    title: part.title,
    conversationIds: part.conversationIds,
    color: part.color,
  };
  return restored;
}

function pushOutcomeFromJsonV1(fileName: string, part: ExportedConversationJsonV1, outcome: ImportedOutcome) {
  const restored = createConversationFromJsonV1(part);
  if (!restored)
    outcome.conversations.push({ success: false, fileName, error: `Invalid conversation: ${part.id}` });
  else
    outcome.conversations.push({ success: true, fileName, conversation: restored });
}


/// EXPORT ///

/**
 * Download all conversations as a JSON file, for backup and future restore
 * @throws {Error} if the user closes the dialog, or file could not be saved
 */
export async function downloadAllConversationsJson() {
  // conversations and
  const { folders, enableFolders } = useFolderStore.getState();
  const payload: ExportedAllJsonV1b = {
    conversations: useChatStore.getState().conversations.map(conversationToJsonV1),
    folders: { folders, enableFolders },
    models: { sources: useModelsStore.getState().sources },
  };
  const json = JSON.stringify(payload);
  const blob = new Blob([json], { type: 'application/json' });

  // link to begin the download
  const isoDate = new Date().toISOString().replace(/:/g, '-');
  await fileSave(blob, { fileName: `conversations-${isoDate}.json`, extensions: ['.json'] });
}

const loadImage = async (url: string | URL | Request): Promise<string | HTMLImageElement | HTMLCanvasElement | Uint8Array | RGBAData> => {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    // @ts-ignore
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
};

/**
 * Download a conversation as a JSON file, for backup and future restore
 * @throws {Error} if the user closes the dialog, or file could not be saved
 */
export async function downloadConversation(conversation: DConversation, format: 'json' | 'markdown' | 'pdf') {

  let blob: Blob;
  let extension: string;

  if (format == 'json') {
    // remove fields (abortController, etc.) from the export
    let exportableConversation: ExportedConversationJsonV1 = conversationToJsonV1(conversation);

    // remove system messages
    exportableConversation.messages = exportableConversation.messages.filter(message => message.role !== "system");

    const json = JSON.stringify(exportableConversation, null, 2);
    blob = new Blob([json], { type: 'application/json' });
    extension = '.json';

    // bonify title for saving to file (spaces to dashes, etc)
    const fileTitle = conversationTitle(conversation).replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'untitled';

    // link to begin the download
    await fileSave(blob, { fileName: `conversation-${fileTitle ? fileTitle + '-' : ''}${conversation.id}${extension}`, extensions: [extension] });
  }
  else if (format == 'markdown') {
    const exportableMarkdown = conversationToMarkdown(conversation, false, true, (sender: string) => `## ${sender} ##`);
    blob = new Blob([exportableMarkdown], { type: 'text/markdown' });
    extension = '.md';
    // bonify title for saving to file (spaces to dashes, etc)
    const fileTitle = conversationTitle(conversation).replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'untitled';

    // link to begin the download
    await fileSave(blob, { fileName: `conversation-${fileTitle ? fileTitle + '-' : ''}${conversation.id}${extension}`, extensions: [extension] });
  }
  else if (format == 'pdf') {

    let exportableConversation: ExportedConversationJsonV1 = conversationToJsonV1(conversation);

    // remove system messages
    exportableConversation.messages = exportableConversation.messages.filter(message => message.role !== "system");

    console.log(exportableConversation);

    // Convertendo HTML para PDF com jsPDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Margens padrão
    const margin = 20;
    const pageWidth = 210; // Largura A4 em mm
    const pageHeight = 297; // Altura A4 em mm
    const maxLineWidth = pageWidth - (margin * 2); // Largura máxima do texto
    const lineHeight = pdf.getLineHeight();

    pdf.setFont('Helvetica', 'normal');
    pdf.setFontSize(11);

    let currentYPosition = margin + 10;

    for(let i = 0; i < exportableConversation.messages.length; i++){
      let message = exportableConversation.messages[i];
      let sender: string = message.sender;
      let text = message.text;
      switch (message.role) {
        case 'assistant':
          const purpose = exportableConversation.systemPurposeId;
          sender = `${purpose || 'Assistente'} · *${prettyBaseModel(message.originLLM || '')}*`.trim();
          break;
        case 'user':
          sender = 'Você';
          break;
      }

      let splitText = pdf.splitTextToSize(sender, maxLineWidth);
      splitText.forEach((textLine: string | string[], index: any) => {
        if (currentYPosition > pageHeight - margin) {
          pdf.addPage();
          currentYPosition = margin + 10;
        }

        pdf.setFillColor(200, 200, 200); // Grey
        pdf.setTextColor(0, 0, 0);
        pdf.rect(margin, currentYPosition - 5, maxLineWidth, 7, 'F');

        pdf.text(textLine, margin, currentYPosition);
        currentYPosition += 7; // Ajuste conforme necessário
      });

      const regexImg = /!\[.*\]\((.*?)\)/;
      const match = text.match(regexImg);
      if (match) {
        const imageUrl = match[1];
        // const image = await loadImage(imageUrl);

        // Definindo o tamanho da imagem
        const imgWidth = 512;
        const imgHeight = 512;

        const image = new Image();
        image.src = imageUrl;
        image.height = imgHeight;
        image.width = imgWidth;

        // Adicionando a imagem ao PDF
        pdf.addImage(image, 'JPEG', margin, currentYPosition, imgWidth, imgHeight);

        // Atualizando a posição Y após a imagem
        currentYPosition += imgHeight + 10; // Adiciona espaço após a imagem
      } else {
        splitText = pdf.splitTextToSize(text, maxLineWidth);
        splitText.forEach((textLine: string | string[], index: any) => {
          if (currentYPosition > pageHeight - margin) {
            pdf.addPage();
            currentYPosition = margin + 10;
          }

          pdf.setFillColor(255, 255, 255); // White

          pdf.text(textLine, margin, currentYPosition);
          currentYPosition += 7;
        });
      }
      currentYPosition += 3;
    }

    const fileTitle = conversationTitle(conversation).replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'untitled';
    pdf.save(`conversation-${fileTitle ? fileTitle + '-' : ''}${conversation.id}.pdf`);
  }
  else {
    throw new Error(`Invalid download format: ${format}`);
  }


}

/**
 * Primitive rendering of a Conversation to Markdown
 */
export function conversationToMarkdown(conversation: DConversation, hideSystemMessage: boolean, exportTitle: boolean, senderWrap?: (text: string) => string): string {
  const mdTitle = exportTitle
    ? `# ${capitalizeFirstLetter(conversationTitle(conversation, Brand.Title.Common + ' Chat'))}\nA ${Brand.Title.Common} conversation, updated on ${(new Date(conversation.updated || conversation.created)).toLocaleString()}.\n\n`
    : '';

  conversation.messages = conversation.messages.filter(message => message.role !== "system");

  return mdTitle + conversation.messages.filter(message => !hideSystemMessage || message.role !== 'system').map(message => {
    let sender: string = message.sender;
    let text = message.text;
    switch (message.role) {
      case 'system':
        sender = '✨ System message';
        text = '<img src="https://i.giphy.com/media/jJxaUysjzO9ri/giphy.webp" width="48" height="48" alt="typing fast meme"/>\n\n' + '*' + text + '*';
        break;
      case 'assistant':
        const purpose = message.purposeId || conversation.systemPurposeId || null;
        sender = `${purpose || 'Assistant'} · *${prettyBaseModel(message.originLLM || '')}*`.trim();
        if (purpose && purpose in SystemPurposes)
          sender = `${SystemPurposes[purpose]?.symbol || ''} ${sender}`.trim();
        break;
      case 'user':
        sender = '👤 You';
        break;
    }
    return (senderWrap?.(sender) || `### ${sender}`) + `\n\n${text}\n\n`;
  }).join('---\n\n');

}

export function conversationToJsonV1(_conversation: DConversation): ExportedConversationJsonV1 {
  // remove fields from the export
  const { abortController, tokenCount, ...conversation } = _conversation;
  return conversation;
}


/// STORED TYPES definitions ///
/// do not change these - consider people's backups

type ExportedConversationJsonV1 = {
  id: string;
  messages: DMessage[];
  systemPurposeId: SystemPurposeId;
  userTitle?: string;
  autoTitle?: string;
  created: number;
  updated: number | null;
}

type ExportedFolderJsonV1 = { // this is here to 'freeze' in time and cause typescript errors when we alter the real def
  id: string;
  title: string;
  conversationIds: DConversationId[];
  color?: string; // Optional color property
}

type ExportedAllJsonV1b = {
  conversations: ExportedConversationJsonV1[];
  models: { sources: DModelSource[] };
  folders?: { folders: ExportedFolderJsonV1[]; enableFolders: boolean };
}
