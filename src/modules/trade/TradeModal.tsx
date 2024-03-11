import * as React from 'react';

import { DConversationId } from '~/common/state/store-chats';
import { GoodModal } from '~/common/components/GoodModal';

import { ExportChats, ExportConfig } from './ExportChats';
import { ImportChats, ImportConfig } from './ImportChats';

export type TradeConfig = ImportConfig | ExportConfig;

export function TradeModal(props: { config: TradeConfig, onConversationActivate: (conversationId: DConversationId) => void, onClose: () => void }) {
  return (
    <GoodModal
      open onClose={props.onClose}
      dividers
      title={<>
        <b>{props.config.dir === 'import' ? 'Importar ' : props.config.dir === 'export' ? 'Exportar ' : ''}</b> {(props.config.dir === 'export' && !props.config.exportAll) ? 'conversa' : 'conversas'}
      </>}
    >

      {props.config.dir === 'import' && (
        <ImportChats onConversationActivate={props.onConversationActivate} onClose={props.onClose} />
      )}

      {props.config.dir === 'export' && (
        <ExportChats config={props.config} onClose={props.onClose} />
      )}

    </GoodModal>
  );
}
