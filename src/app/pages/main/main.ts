import { Component, OnInit, signal } from '@angular/core';
import { ChatList } from '../../components/chat-list/chat-list';
import { ChatResponse, MessageResponse } from '../../api/models';
import { Api } from '../../api/api';
import { getAllChats, getMessages } from '../../api/functions';
import { from } from 'rxjs';
import { KeycloakService } from '../../utils/keycloak/keycloak.service';
import { ChatBox } from '../../components/chat-box/chat-box';

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

  constructor(
    private api: Api,
    private keycloakService: KeycloakService
  ) {}
  
  ngOnInit(): void {
    this.getAllChats();
  }

  private async getAllChats() {
    try {
          const chats = await this.api.invoke(getAllChats);

    const sortedChats = chats.sort((a, b) => {
      const dateA = new Date(a.lastMessageTime ?? 0).getTime();
      const dateB = new Date(b.lastMessageTime ?? 0).getTime();
      return dateB - dateA; // Descending (الأحدث الأول)
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
    this.chats.update(prev => [chat, ...prev]);
  }

  userProfile() {
    this.keycloakService.accountMangement();
  }

  logout() {
    this.keycloakService.logout();  
  }

}
