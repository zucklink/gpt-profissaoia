import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { AppChat } from '../src/apps/chat/AppChat';
import { withLayout } from '~/common/layout/withLayout';
import { useConversation } from '~/common/state/store-chats';



export default function IndexPage() {

  // TODO: This Index page will point to the Dashboard (or a landing page)
  // For now it offers the chat experience, but this will change. #299

  const {
    setUserName,
    getUserName,
    setUser,
    getUser,
  } = useConversation(null);

  const router = useRouter();

  useEffect(() => {
    if (router.isReady) {
      const { name, email, phone, plans } = router.query;

      setUser(email as string);
      setUserName(name as string);
    }
  }, [router.isReady, router.query, setUser, setUserName]);

  useEffect(() => {
    console.log('user: ', getUser());
    console.log('userName: ', getUserName());
  }, [getUser, getUserName]);

  return withLayout({ type: 'optima' }, <AppChat />);
}
