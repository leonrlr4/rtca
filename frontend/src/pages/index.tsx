import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { log } from "console";
import { FormEvent, useEffect, useRef, useState } from "react";
import io, { Socket } from "socket.io-client";

// 如果環境變數中設置了socket連接URL則使用該值 否則使用預設值
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "ws://127.0.0.1";
// 與server通信時使用的事件頻道名稱
const CONNECTION_COUNT_UPDATED_CHANNEL = "chat:connection-count-updated";
const NEW_MESSAGE_CHANNEL = "chat:new-message";

// 訊息的類型，包括訊息內容,id,創建時間,port號
type Message = {
  message: string;
  id: string;
  createdAt: string;
  port: string;
};
// 用來處理和初始化socket連線
function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // 使用socket.io-client來建立一個新的socket連線
    const socketIo = io(SOCKET_URL, {
      reconnection: true,
      upgrade: true,
      transports: ["websocket", "polling"],
    });
    // 將socket實例保存到狀態中
    setSocket(socketIo);

    return function () {
      socketIo.disconnect();
    };
  }, []);

  return socket;
}

export default function Home() {
  // 創建一個ref來引用訊息列表的DOM元素
  const messageListRef = useRef<HTMLOListElement | null>(null);
  // 用來管理新訊息輸入的狀態
  const [newMessage, setNewMessage] = useState("");
  // 用來管理訊息列表的狀態
  const [messages, setMessages] = useState<Array<Message>>([]);
  // 用來管理連線數量的狀態
  const [connectionCount, setConnectionCount] = useState(0);
  // 使用自定義hoo獲取socket實例
  const socket = useSocket();

  // 超出範圍大小時滾動至訊息列表的底部
  function scrollToBottom() {
    if (messageListRef.current) {
      messageListRef.current.scrollTop =
        messageListRef.current.scrollHeight + 1000;
    }
  }
  // 當socket實例可用時設定事件監聽
  useEffect(() => {
    // 監聽連線事件: 當連線成功時在控制台輸出連線成功訊息
    socket?.on("connect", () => {
      console.log("connected to socket");
    });

    socket?.on(NEW_MESSAGE_CHANNEL, (message: Message) => {
      setMessages((prevMessages) => [...prevMessages, message]);
      console.log(message.port);

      setTimeout(() => {
        scrollToBottom();
      }, 0);
    });

    socket?.on(
      CONNECTION_COUNT_UPDATED_CHANNEL,
      ({ count }: { count: number }) => {
        setConnectionCount(count);
      }
    );
  }, [socket]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    socket?.emit(NEW_MESSAGE_CHANNEL, {
      message: newMessage,
    });

    setNewMessage("");
  }

  return (
    <main className="flex flex-col p-4 w-full max-w-3xl m-auto">
      <h1 className="text-4xl font-bold text-center mb-4">
        Chat
      </h1>
      <ol
        className="flex-1 overflow-y-scroll overflow-x-hidden"
        ref={messageListRef}
      >
        {messages.map((m) => {
          return (
            <li
              className="bg-gray-100 rounded-lg p-4 my-2 break-all"
              key={m.id}
            >
              <p className="text-small text-gray-500">{m.createdAt}</p>
              <p className="text-small text-gray-500">{m.port}</p>
              <p>{m.message}</p>
            </li>
          );
        })}
      </ol>

      <form onSubmit={handleSubmit} className="flex items-center">
        <Textarea
          className="rounded-lg mr-4"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          maxLength={255}
        />
        <Button className="h-full">Send message</Button>
      </form>
    </main>
  );
}