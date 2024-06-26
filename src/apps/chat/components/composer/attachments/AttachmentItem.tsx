import * as React from 'react';

import { Box, Button, CircularProgress, ColorPaletteProp, Sheet, Typography } from '@mui/joy';
import AbcIcon from '@mui/icons-material/Abc';
import CodeIcon from '@mui/icons-material/Code';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import PivotTableChartIcon from '@mui/icons-material/PivotTableChart';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import TextureIcon from '@mui/icons-material/Texture';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import { GoodTooltip } from '~/common/components/GoodTooltip';
import { ellipsizeFront, ellipsizeMiddle } from '~/common/util/textUtils';

import type { Attachment, AttachmentConverterType, AttachmentId } from './store-attachments';
import type { LLMAttachment } from './useLLMAttachments';


// default attachment width
const ATTACHMENT_MIN_STYLE = {
  height: '100%',
  minHeight: '40px',
  minWidth: '64px',
};


const ellipsizeLabel = (label?: string) => {
  if (!label)
    return '';
  return ellipsizeMiddle((label || '')
  .replace(/https?:\/\/(?:www\.)?/, ''), 30)
  .replace(/\/$/, '')
  .replace('…', '…\n…');
};


/**
 * Displayed while a source is loading
 */
const LoadingIndicator = React.forwardRef((props: { label: string }, _ref) =>
  <Sheet
    color="success" variant="soft"
    sx={{
      border: '1px solid',
      borderColor: 'success.solidBg',
      borderRadius: 'sm',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
      ...ATTACHMENT_MIN_STYLE,
      boxSizing: 'border-box',
      px: 1,
      py: 0.5,
    }}
  >
    <CircularProgress color="success" size="sm" />
    <Typography level="title-sm" sx={{ whiteSpace: 'nowrap' }}>
      {ellipsizeLabel(props.label)}
    </Typography>
  </Sheet>,
);
LoadingIndicator.displayName = 'LoadingIndicator';


const InputErrorIndicator = () =>
  <WarningRoundedIcon sx={{ color: 'danger.solidBg' }} />;


const converterTypeToIconMap: { [key in AttachmentConverterType]: React.ComponentType<any> } = {
  'text': TextFieldsIcon,
  'rich-text': CodeIcon,
  'rich-text-table': PivotTableChartIcon,
  'pdf-text': PictureAsPdfIcon,
  'pdf-images': PictureAsPdfIcon,
  'image': ImageOutlinedIcon,
  'image-ocr': AbcIcon,
  'unhandled': TextureIcon,
};

function attachmentConverterIcon(attachment: Attachment) {
  const converter = attachment.converterIdx !== null ? attachment.converters[attachment.converterIdx] ?? null : null;
  if (converter && converter.id) {
    const Icon = converterTypeToIconMap[converter.id] ?? null;
    if (Icon)
      return <Icon sx={{ width: 24, height: 24 }} />;
  }
  return null;
}

function attachmentLabelText(attachment: Attachment): string {
  const converter = attachment.converterIdx !== null ? attachment.converters[attachment.converterIdx] ?? null : null;
  if (converter && attachment.label === 'Rich Text') {
    if (converter.id === 'rich-text-table')
      return 'Rich Table';
    if (converter.id === 'rich-text')
      return 'Rich HTML';
  }
  return ellipsizeFront(attachment.label, 24);
}


export function AttachmentItem(props: {
  llmAttachment: LLMAttachment,
  menuShown: boolean,
  onItemMenuToggle: (attachmentId: AttachmentId, anchor: HTMLAnchorElement) => void,
}) {

  // derived state

  const { onItemMenuToggle } = props;

  const {
    attachment,
    isUnconvertible,
    isOutputMissing,
    isOutputAttachable,
  } = props.llmAttachment;

  const {
    inputError,
    inputLoading: isInputLoading,
    outputsConverting: isOutputLoading,
  } = attachment;

  const isInputError = !!inputError;
  const showWarning = isUnconvertible || isOutputMissing || !isOutputAttachable;


  const handleToggleMenu = React.useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
    onItemMenuToggle(attachment.id, event.currentTarget);
  }, [attachment, onItemMenuToggle]);


  // compose tooltip
  let tooltip: string | null = '';
  if (attachment.source.media !== 'text')
    tooltip += attachment.source.media + ': ';
  tooltip += attachment.label;
  // if (hasInput)
  //   tooltip += `\n(${aInput.mimeType}: ${aInput.dataSize.toLocaleString()} bytes)`;
  // if (aOutputs && aOutputs.length >= 1)
  //   tooltip += `\n\n${JSON.stringify(aOutputs)}`;

  // choose variants and color
  let color: ColorPaletteProp;
  let variant: 'soft' | 'outlined' | 'contained' = 'soft';
  if (isInputLoading || isOutputLoading) {
    color = 'success';
  } else if (isInputError) {
    tooltip = `Problema ao carregar o anexo: ${attachment.inputError}\n\n${tooltip}`;
    color = 'danger';
  } else if (showWarning) {
    tooltip = props.menuShown
      ? null
      : isUnconvertible
        ? `Anexos do tipo '${attachment.input?.mimeType}' ainda não são suportados. Você pode abrir uma solicitação de recurso no GitHub.\n\n${tooltip}`
        : `Não é compatível com o LLM selecionado ou não é suportado. Por favor, selecione outro formato.\n\n${tooltip}`;
    color = 'warning';
  } else {
    // all good
    tooltip = null;
    color = /*props.menuShown ? 'primary' :*/ 'neutral';
    variant = 'outlined';
  }


  return <Box>

    <GoodTooltip
      title={tooltip}
      isError={isInputError}
      isWarning={showWarning}
      sx={{ p: 1, whiteSpace: 'break-spaces' }}
    >
      {isInputLoading
        ? <LoadingIndicator label={attachment.label} />
        : (
          <Button
            size="sm"
            variant={variant} color={color}
            onClick={handleToggleMenu}
            sx={{
              backgroundColor: props.menuShown ? `${color}.softActiveBg` : variant === 'outlined' ? 'background.popup' : undefined,
              border: variant === 'soft' ? '1px solid' : undefined,
              borderColor: variant === 'soft' ? `${color}.solidBg` : undefined,
              borderRadius: 'sm',
              ...ATTACHMENT_MIN_STYLE,
              px: 1, py: 0.5,
              display: 'flex', flexDirection: 'row', gap: 1,
            }}
          >
            {isInputError
              ? <InputErrorIndicator />
              : <>
                {attachmentConverterIcon(attachment)}
                {isOutputLoading
                  ? <>Converting <CircularProgress color="success" size="sm" /></>
                  : <Typography level="title-sm" sx={{ whiteSpace: 'nowrap' }}>
                    {attachmentLabelText(attachment)}
                  </Typography>}
              </>}
          </Button>
        )}
    </GoodTooltip>

  </Box>;
}
