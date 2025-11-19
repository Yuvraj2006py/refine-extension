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

    function getURL(path: string): string;
  }

  namespace storage {
    interface StorageArea {
      get(
        keys: string | string[] | Record<string, unknown>,
        callback: (items: Record<string, unknown>) => void
      ): void;
      set(items: Record<string, unknown>, callback: () => void): void;
    }

    const sync: StorageArea;

    interface StorageChange {
      oldValue?: unknown;
      newValue?: unknown;
    }

    namespace onChanged {
      function addListener(
        callback: (changes: Record<string, StorageChange>, areaName: "sync" | "local") => void
      ): void;
    }
  }

  namespace tabs {
    interface Tab {
      id?: number;
      url?: string;
      active?: boolean;
    }

    function query(
      queryInfo: { active?: boolean; currentWindow?: boolean },
      callback: (tabs: Tab[]) => void
    ): void;

    function sendMessage(tabId: number, message: any, responseCallback?: (response?: any) => void): void;
  }
}
