import { addSnackbar } from '../components/useSnackbarsStore';
import { isBrowser, isFirefox, isInIframe } from './pwaUtils';

export function copyToClipboard(text: string, typeLabel: string) {
  if (!isBrowser) {
    return;
  }

  if (isInIframe()) {
    window.parent.postMessage({ type: "copyToClipboard", text: text }, "*");
    addSnackbar({
      key: 'copy-to-clipboard',
      message: 'Conteúdo copiado para área de transferência',
      type: 'success',
      closeButton: false,
      overrides: {
        autoHideDuration: 1400,
      },
    });
    return;
  }

  window.navigator.clipboard.writeText(text)
    .then(() => {
      addSnackbar({
        key: 'copy-to-clipboard',
        message: 'Conteúdo copiado para área de transferência',
        type: 'success',
        closeButton: false,
        overrides: {
          autoHideDuration: 1400,
        },
      });
    })
    .catch((err) => {
      console.error('Falha ao copiar mensagem: ', err);
    });
}

// NOTE: this could be implemented in a platform-agnostic manner with !!.read, but we call it out here for clarity
export const supportsClipboardRead = !isFirefox;

export async function getClipboardItems(): Promise<ClipboardItem[] | null> {
  if (!isBrowser || !window.navigator.clipboard?.read)
    return [];
  try {
    return await window.navigator.clipboard.read();
  } catch (error: any) {
    console.warn('Falha ao ler área de transferência: ', error);
    return null;
  }
}
