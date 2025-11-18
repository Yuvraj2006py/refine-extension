declare namespace chrome {
  namespace runtime {
    interface MessageSender {
      tab?: {
        id?: number;
      };
      frameId?: number;
      id?: string;
      url?: string;
    }

    type MessageResponseCallback = (response?: any) => void;

    interface OnMessageEvent {
      addListener(
        callback: (
          message: any,
          sender: MessageSender,
          sendResponse: MessageResponseCallback
        ) => void
      ): void;
    }

    const onMessage: OnMessageEvent;

    function sendMessage(message: any, responseCallback?: MessageResponseCallback): void;

    let lastError: { message?: string } | undefined;
  }
}
