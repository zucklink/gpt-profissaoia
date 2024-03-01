import * as React from 'react';

import { Box, Button, ButtonGroup, CircularProgress, Divider, FormControl, FormLabel, Grid, IconButton, Input } from '@mui/joy';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ReplayIcon from '@mui/icons-material/Replay';
import StopOutlinedIcon from '@mui/icons-material/StopOutlined';
import TelegramIcon from '@mui/icons-material/Telegram';

import { BlocksRenderer } from '~/modules/blocks/BlocksRenderer';
import { llmStreamingChatGenerate } from '~/modules/llms/llm.client';

import { GoodModal } from '~/common/components/GoodModal';
import { InlineError } from '~/common/components/InlineError';
import { createDMessage, useChatStore } from '~/common/state/store-chats';
import { useFormRadio } from '~/common/components/forms/useFormRadio';
import { useFormRadioLlmType } from '~/common/components/forms/useFormRadioLlmType';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { bigDiagramPrompt, DiagramLanguage, diagramLanguages, DiagramType, diagramTypes } from './diagrams.data';


// Used by the callers to setup the diagam session
export interface DiagramConfig {
  conversationId: string;
  messageId: string,
  text: string;
}


// This method fixes issues in the generation output. Very heuristic.
function hotFixDiagramCode(llmCode: string): string {
  // put the code in markdown, if missing
  if (llmCode.startsWith('@start'))
    llmCode = '```\n' + llmCode + '\n```';
  // fix generation mistakes
  return llmCode
    .replaceAll('@endmindmap\n@enduml', '@endmindmap')
    .replaceAll('```\n```', '```');
}


export function DiagramsModal(props: { config: DiagramConfig, onClose: () => void; }) {

  // state
  const [showOptions, setShowOptions] = React.useState(true);
  const [diagramCode, setDiagramCode] = React.useState<string | null>(null);
  const [diagramType, diagramComponent] = useFormRadio<DiagramType>('auto', diagramTypes, 'Visualizar');
  const [diagramLanguage, languageComponent] = useFormRadio<DiagramLanguage>('plantuml', diagramLanguages, 'Estilo');
  const [customInstruction, setCustomInstruction] = React.useState<string>('');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [abortController, setAbortController] = React.useState<AbortController | null>(null);

  // external state
  const isMobile = useIsMobile();
  const contentScaling = useUIPreferencesStore(state => state.contentScaling);
  const [diagramLlm, llmComponent] = useFormRadioLlmType('Generator');

  // derived state
  const { conversationId, text: subject } = props.config;


  /**
   * Core Diagram Generation function, with Streaming, custom prompt, etc.
   */
  const handleGenerateNew = React.useCallback(async () => {
    if (abortController)
      return;

    const conversation = useChatStore.getState().conversations.find(c => c.id === conversationId);
    if (!diagramType || !diagramLanguage || !diagramLlm || !conversation) {
      return setErrorMessage('Tipo de diagrama, idioma, gerador ou conversa inválidos.');
    }
    const systemMessage = conversation?.messages?.length ? conversation.messages[0] : null;
    if (systemMessage?.role !== 'system') {
      return setErrorMessage('Nenhuma mensagem do sistema nesta conversa');
    }

    setErrorMessage(null);

    let diagramCode: string = 'Carregando...';
    setDiagramCode(diagramCode);

    const stepAbortController = new AbortController();
    setAbortController(stepAbortController);

    const diagramPrompt = bigDiagramPrompt(diagramType, diagramLanguage, systemMessage.text, subject, customInstruction);

    try {
      await llmStreamingChatGenerate(diagramLlm.id, diagramPrompt, null, null, stepAbortController.signal,
        ({ textSoFar }) => textSoFar && setDiagramCode(diagramCode = textSoFar),
      );
    } catch (error: any) {
      setDiagramCode(null);
      setErrorMessage(error?.name !== 'AbortError' ? error?.message : 'Interrupted.');
    } finally {
      setDiagramCode(hotFixDiagramCode(diagramCode));
      setAbortController(null);
    }

  }, [abortController, conversationId, diagramLanguage, diagramLlm, diagramType, subject, customInstruction]);


  // [Effect] Auto-abort on unmount
  React.useEffect(() => {
    return () => {
      if (abortController) {
        abortController.abort();
        setAbortController(null);
      }
    };
  }, [abortController]);


  const handleInsertAndClose = () => {
    if (!diagramCode)
      return setErrorMessage('Nada para adicionar à conversa.');

    const diagramMessage = createDMessage('assistant', diagramCode);
    // diagramMessage.purposeId = conversation.systemPurposeId;
    diagramMessage.originLLM = 'diagram';

    useChatStore.getState().appendMessage(conversationId, diagramMessage);
    props.onClose();
  };


  return <GoodModal
    title='Generar Diagrama' noTitleBar
    open onClose={props.onClose}
    sx={{ maxWidth: { xs: '100vw', md: '95vw' } }}
    startButton={
      <Button variant='soft' color='success' disabled={!diagramCode || !!abortController} endDecorator={<TelegramIcon />} onClick={handleInsertAndClose}>
        Adicionar ao chat
      </Button>
    }
  >

    {showOptions && (
      <Grid container spacing={2}>
        <Grid xs={12} md={6}>
          {diagramComponent}
        </Grid>
        {languageComponent && (
          <Grid xs={12} md={6}>
            {languageComponent}
          </Grid>
        )}
        <Grid xs={12} xl={6}>
          {llmComponent}
        </Grid>
        <Grid xs={12} md={6}>
          <FormControl>
            <FormLabel>Instrução personalizada</FormLabel>
            <Input title='Instrução personalizada' placeholder='ex. visualizar como estado' value={customInstruction} onChange={(e) => setCustomInstruction(e.target.value)} />          </FormControl>
        </Grid>
      </Grid>
    )}

    <ButtonGroup color='primary' sx={{ flexGrow: 1 }}>
      <Button
        fullWidth
        variant={abortController ? 'soft' : 'solid'} color='primary'
        disabled={!diagramLlm}
        onClick={abortController ? () => abortController.abort() : handleGenerateNew}
        endDecorator={abortController ? <StopOutlinedIcon /> : diagramCode ? <ReplayIcon /> : <AccountTreeIcon />}
        sx={{ minWidth: 200 }}
      >
        {abortController ? 'Parar' : diagramCode ? 'Gerar novamente' : 'Gerar'}
      </Button>
      <IconButton onClick={() => setShowOptions(options => !options)}>
        {showOptions ? <ExpandLessIcon /> : <ExpandMoreIcon />}
      </IconButton>
    </ButtonGroup>

    {errorMessage && <InlineError error={errorMessage} />}

    {!showOptions && !!abortController && <Box sx={{ display: 'flex', justifyContent: 'center' }}>
      <CircularProgress size='lg' />
    </Box>}

    {!!diagramCode && (!abortController || showOptions) && (
      <Box sx={{
        backgroundColor: 'background.level2',
        marginX: 'calc(-1 * var(--Card-padding))',
        minHeight: 96,
        p: { xs: 1, md: 2 },
        overflow: 'hidden',
      }}>
        <BlocksRenderer
          text={diagramCode}
          fromRole='assistant'
          fitScreen={isMobile}
          contentScaling={contentScaling}
          renderTextAsMarkdown={false}
          specialDiagramMode
          // onMessageEdit={(text) => setMessage({ ...message, text })}
        />
      </Box>
    )}

    {!diagramCode && <Divider />}

  </GoodModal>;
}
