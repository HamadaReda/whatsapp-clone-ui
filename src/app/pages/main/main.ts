import { Component, OnInit, signal } from '@angular/core';
import { ChatList } from '../../components/chat-list/chat-list';
import { ChatResponse, MessageResponse, UserResponse } from '../../api/models';
import { Api } from '../../api/api';
import { findUserByKeycloakId, getAllChats, getMessages, markMessageAsRead } from '../../api/functions';
import { from, take } from 'rxjs';
import { KeycloakService } from '../../utils/keycloak/keycloak.service';
import { ChatBox } from '../../components/chat-box/chat-box';
import  SockJS from 'sockjs-client';
import * as Stomp from 'stompjs';
import { Notification } from '../../models/notification';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-main',
  imports: [ChatList, ChatBox],
  templateUrl: './main.html',
  styleUrl: './main.scss',
})
export class Main implements OnInit {
  
  chats = signal<ChatResponse[]>([]);
  selectedChat: ChatResponse = {};
  chatMessages = signal<MessageResponse[]>([]);
  page = 0;
  size = 20;
  last = false;
  loading = false;
  socketClient: any = null;
  notificationSubscription: any = null;
  currentUser = signal<UserResponse | null>(null);

  constructor(
    private api: Api,
    private keycloakService: KeycloakService
  ) {}
  
  async ngOnInit(): Promise<void> {
    await this.getCurrentUser();
    this.initWebSocket();
    await this.getAllChats();             // 2nd
  }


  ngOnDestroy(): void {
    if (this.socketClient !== null) {
      this.socketClient.disconnect();
      this.notificationSubscription.unsubscribe();
      this.socketClient = null;
    }
  }

    private async getCurrentUser() {
      try {
        const user = await this.api.invoke(findUserByKeycloakId, {
          "keycloak-id": this.keycloakService.userId
        });

        this.currentUser.set(user);

      } catch (error) {
        console.error("Error fetching user", error);
      }
    }

  private async getAllChats() {
    try {
      const chats = await this.api.invoke(getAllChats);
      const sortedChats = chats.sort((a, b) => {
      const dateA = new Date(a.lastMessageTime ?? 0).getTime();
      const dateB = new Date(b.lastMessageTime ?? 0).getTime();
      return dateB - dateA; 
    });

    this.chats.set(sortedChats);
    } catch (error) {
      console.error('Error fetching chats:', error);
    }
  }

  private getChatMessages(chatId: string) {
    from(
      this.api.invoke(getMessages,{
      "chat-id": chatId,
      page: this.page,
      size: this.size
    })
    ).subscribe({
      next: (slice) => {
        const newMessages = (slice.content ?? []).reverse();
        this.chatMessages.set([...newMessages, ...this.chatMessages()]);

        this.last = slice.last ?? false;
        this.page++;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error fetching messages:', error);
        this.loading = false;
      }
    });
  }

  private setMessagesAsRead(chatId: string) {
      if (!chatId) return;
      return from(
        this.api.invoke(markMessageAsRead, { "chat-id": chatId })
      ).pipe(
        take(1)
      );
    }

  onSendNewMessage(message: MessageResponse) {
    this.chatMessages.set([...this.chatMessages(), message]);
  }

  onUpdateLastMessage(lastMessage: string){
    this.selectedChat.lastMessage = lastMessage;
  }

  chatSelected(chat: ChatResponse) {
    this.selectedChat = chat;
    // Reset state
    this.chatMessages.set([]);
    this.page = 0;
    this.last = false;
    this.getChatMessages(chat.id ?? '');
    this.selectedChat.unreadCount = 0;
  }

  onSendNewChat(chat: ChatResponse) {
    if (this.chats().some(c => c.id === chat.id)) return;
    else this.chats.update(prev => [chat, ...prev]);
  }

  userProfile() {
    this.keycloakService.accountMangement();
  }

  logout() {
    this.keycloakService.logout();  
  }  

   private getCurrentUserId(kecloakId: string) {
    from(this.api.invoke(findUserByKeycloakId, { "keycloak-id": kecloakId }))
      .subscribe(user => user.id as string);
   }


  private initWebSocket() {
    if (this.keycloakService.keycloak.tokenParsed?.sub) {
      const socket = new SockJS(`${environment.apiUrl}/ws`);
      this.socketClient = Stomp.over(socket);
      const subUrl = `/user/${this.keycloakService.keycloak.tokenParsed?.sub}/chat`;
      this.socketClient.connect({
        Authorization: `Bearer ${this.keycloakService.keycloak.token}`
      }, () => {
        this.notificationSubscription = this.socketClient.subscribe(subUrl, 
          (message: any) => {
            const notification: Notification = JSON.parse(message.body);
            this.handleNotification(notification);
          },
          () => console.error('Error while connecting to webSocket')
        );
      });
    }

  }

  private handleNotification(notification: Notification) {
    if (!notification) return;
    if (this.selectedChat && this.selectedChat.id === notification.chatId) {
      switch(notification.type) { 
        case 'MESSAGE':
        case 'IMAGE':
          const newMessage: MessageResponse = {
            content: notification.content,
            senderId: notification.senderId,
            receiverId: notification.receiverId,
            type: notification.messageType,
            media: notification.media,
            createdAt: new Date().toISOString()
          }
          if (notification.messageType === 'TEXT') {
            this.selectedChat.lastMessage = notification.content;
          } else {
            this.selectedChat.lastMessage = "Attachment";
          }
          this.chatMessages.update(messages => [...messages, newMessage]); 
          this.setMessagesAsRead(this.selectedChat.id??'')?.subscribe(); 
          break;
        case 'SEEN':
          this.chatMessages.update(messages => 
            messages.map(m =>
              m.senderId === notification.receiverId && m.state !== 'SEEN'
                ? { ...m, state: 'SEEN' }
                : m
            )
          );
          break;
      }
    } else {
      const destChat = this.chats().find(c => c.id === notification.chatId);
      if (destChat && notification.type !== 'SEEN') {
        if (notification.type === 'MESSAGE'){
          destChat.lastMessage = notification.content;
        } else if (notification.type === 'IMAGE') {
          destChat.lastMessage = "Attachment";
        }
        destChat.unreadCount = (destChat.unreadCount ?? 0) + 1;
        destChat.lastMessageTime = new Date().toISOString();
        this.chats.update(chats => {
          const filtered = chats.filter(c => c.id !== destChat.id);
          return [destChat, ...filtered];
        });
      } else if (notification.type === "MESSAGE") {
        const newChat: ChatResponse = {
          id: notification.chatId,
          otherUserId: notification.senderId,
          currentUserId: notification.receiverId,
          name: notification.chatName,
          lastMessage: notification.content,
          lastMessageTime: new Date().toISOString(),
          unreadCount: 1,
        }
        this.chats.update(prev => [newChat, ...prev]);
      }
    }
  }


}