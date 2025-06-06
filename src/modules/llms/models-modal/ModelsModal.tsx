import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, Checkbox, Divider, Typography } from '@mui/joy';

import { GoodModal } from '~/common/components/GoodModal';
import { runWhenIdle } from '~/common/util/pwaUtils';
import { useOptimaLayout } from '~/common/layout/optima/useOptimaLayout';

import { DLLMId, DModelSource, DModelSourceId, useModelsStore } from '../store-llms';
import { createModelSourceForDefaultVendor, findVendorById } from '../vendors/vendors.registry';

import { LLMOptionsModal } from './LLMOptionsModal';
import { ModelsList } from './ModelsList';
import { ModelsSourceSelector } from './ModelsSourceSelector';
import Image from 'next/image';
import {
  isValidOpenAIApiKey,
  ModelVendorOpenAI,
} from '~/modules/llms/vendors/openai/openai.vendor';
import { useLlmUpdateModels } from '~/modules/llms/vendors/useLlmUpdateModels';
import { useSourceSetup } from '~/modules/llms/vendors/useSourceSetup';
import { useConversation } from '~/common/state/store-chats';


function VendorSourceSetup(props: { source: DModelSource }) {
  const vendor = findVendorById(props.source.vId);
  if (!vendor)
    return 'Configuration issue: Vendor not found for Source ' + props.source.id;
  return <vendor.SourceSetupComponent key={props.source.id} sourceId={props.source.id} />;
}


export function ModelsModal(props: { suspendAutoModelsSetup?: boolean }) {

  // local state
  const [_selectedSourceId, setSelectedSourceId] = React.useState<DModelSourceId | null>(null);
  const [showAllSources, setShowAllSources] = React.useState<boolean>(false);

  // external state
  const {
    closeLlmOptions, closeModelsSetup,
    openLlmOptions, openModelsSetup,
    showLlmOptions, showModelsSetup,
  } = useOptimaLayout();

  const { modelSources, llmCount } = useModelsStore(state => ({
    modelSources: state.sources,
    llmCount: state.llms.length,
  }), shallow);

  const {
    getUserName,
    getUser,
  } = useConversation(null);

  const userName = getUserName();
  const userEmail = getUser();

  // auto-select the first source - note: we could use a useEffect() here, but this is more efficient
  // also note that state-persistence is unneeded
  const selectedSourceId = _selectedSourceId ?? modelSources[modelSources.length - 1]?.id ?? null;

  const activeSource = modelSources.find(source => source.id === selectedSourceId);

  const multiSource = modelSources.length > 1;

  // Auto-open this dialog - anytime no source is selected
  // const autoOpenTrigger = !selectedSourceId && !props.suspendAutoModelsSetup;
  const autoOpenTrigger = true;
  React.useEffect(() => {
    if (autoOpenTrigger)
      return runWhenIdle(openModelsSetup, 2000);
  }, [autoOpenTrigger, openModelsSetup]);

  // Auto-add the default source - at boot, when no source is present
  const autoAddTrigger = showModelsSetup && !props.suspendAutoModelsSetup;
  React.useEffect(() => {
    // Note: we use the immediate version to not react to deletions
    const { addSource, sources } = useModelsStore.getState();
    if (autoAddTrigger && !sources.length)
      addSource(createModelSourceForDefaultVendor(sources));
  }, [autoAddTrigger]);

  // Execute the provided code when the modal is shown
  const { source, sourceHasLLMs, access, updateSetup } =
    // useSourceSetup(activeSource?.id, ModelVendorOpenAI);
    useSourceSetup('openai', ModelVendorOpenAI);

  // derived state
  const { oaiKey, oaiOrg, oaiHost, heliKey, moderationCheck } = access;

  const needsUserKey = !ModelVendorOpenAI.hasBackendCap?.();
  const keyValid = isValidOpenAIApiKey(oaiKey);
  const keyError = (/*needsUserKey ||*/ !!oaiKey) && !keyValid;
  const shallFetchSucceed = oaiKey ? keyValid : !needsUserKey;

  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(ModelVendorOpenAI, access, !sourceHasLLMs && shallFetchSucceed, source);

  React.useEffect(() => {
    if (showModelsSetup && activeSource?.vId === ModelVendorOpenAI.id) {
      const { oaiKey } = access;

      const needsUserKey = !ModelVendorOpenAI.hasBackendCap?.();
      const keyValid = isValidOpenAIApiKey(oaiKey);
      const shallFetchSucceed = oaiKey ? keyValid : !needsUserKey;

      // fetch models
      if (shallFetchSucceed) {
        console.log('Fetching models...');
        refetch();

        // Set the predefined model id
        useModelsStore.getState().setChatLLMId('openai-gpt-4.1-nano');
        useModelsStore.getState().setFastLLMId('openai-gpt-4.1-nano');
        useModelsStore.getState().setFuncLLMId('openai-gpt-4.1-nano');

        console.log('chatLLMId: ', useModelsStore.getState().chatLLMId);
        console.log('fastLLMId: ', useModelsStore.getState().fastLLMId);
        console.log('funcLLMId: ', useModelsStore.getState().funcLLMId);
      }
    }
  }, [showModelsSetup]);

  return <>

    {/* Sources Setup */}
    {showModelsSetup && <GoodModal
      title={<>GPT <b>Profissão IA</b></>}
      startButton={
        multiSource ? <Checkbox
          label="All Services" sx={{ my: 'auto' }}
          checked={showAllSources} onChange={() => setShowAllSources(all => !all)}
        /> : undefined
      }
      open onClose={closeModelsSetup}
      sx={{
        // forces some shrinkage of the contents (ModelsList)
        overflow: 'auto',
      }}
    >

      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
      >
        <Image src="/images/llms/openai-2.svg" height={200} width={200} alt={'Powered by OpenAI'} />

        <Typography level="h2" sx={{ textAlign: 'center' }}>
          GPT Profissão IA
        </Typography>

        <Typography level="h3" sx={{ textAlign: 'center' }}>
          Powered by OpenAI
        </Typography>

        <Typography level="title-sm" sx={{ textAlign: 'center', mt: 2 }}>
          Modelo: {useModelsStore.getState().chatLLMId}
        </Typography>

        <Divider sx={{  mt: 2 }}/>

        {userName &&
          <Typography level="body-sm" sx={{ textAlign: 'center', mt: 2 }}>
            Cópia licenciada e de uso exclusivo de:
          </Typography>}

        {userName &&
          <Typography level="body-sm" sx={{ textAlign: 'center' }}>
          {userName} - {userEmail}
        </Typography>}

      </Box>

      {/*<ModelsSourceSelector selectedSourceId={selectedSourceId} setSelectedSourceId={setSelectedSourceId} />*/}

      {/*{!!activeSource && <Divider />}*/}

      {/*{!!activeSource && (*/}
      {/*  <Box sx={{ display: 'grid', gap: 'var(--Card-padding)' }}>*/}
      {/*    <VendorSourceSetup source={activeSource} />*/}
      {/*  </Box>*/}
      {/*)}*/}

      {/*{!!llmCount && <Divider />}*/}

      {/*{!!llmCount && (*/}
      {/*  <ModelsList*/}
      {/*    filterSourceId={showAllSources ? null : selectedSourceId}*/}
      {/*    onOpenLLMOptions={openLlmOptions}*/}
      {/*    sx={{*/}
      {/*      // works in tandem with the parent (GoodModal > Dialog) overflow: 'auto'*/}
      {/*      minHeight: '6rem',*/}
      {/*      overflowY: 'auto',*/}

      {/*      // style (list variant=outlined)*/}
      {/*      '--ListItem-paddingY': '0rem',*/}
      {/*      '--ListItem-paddingRight': '0.5rem', // instead of 0.75*/}
      {/*      backgroundColor: 'rgb(var(--joy-palette-neutral-lightChannel) / 20%)',*/}
      {/*      borderRadius: 'md',*/}

      {/*      // [mobile] a bit less padding*/}
      {/*      '@media (max-width: 900px)': {*/}
      {/*        '--ListItem-paddingLeft': '0.5rem',*/}
      {/*        '--ListItem-paddingRight': '0.25rem',*/}
      {/*      },*/}
      {/*    }}*/}
      {/*  />*/}
      {/*)}*/}

      <Divider />

    </GoodModal>}

    {/* per-LLM options */}
    {!!showLlmOptions && <LLMOptionsModal id={showLlmOptions} onClose={closeLlmOptions} />}

  </>;
}
