import { Component, input, InputSignal, output, Output } from '@angular/core';
import { ChatResponse, UserResponse } from '../../api/models';
import { Api } from '../../api/api';
import { createChat, findAllUsers, findUserByKeycloakId, markMessageAsRead } from '../../api/functions';
import { from, take } from 'rxjs';
import { KeycloakService } from '../../utils/keycloak/keycloak.service';

@Component({
  selector: 'app-chat-list',
  standalone: true,
  templateUrl: './chat-list.html',
  styleUrl: './chat-list.scss',
})
export class ChatList {

  chats: InputSignal<ChatResponse[]> = input<ChatResponse[]>([]);
  searchNewContact: boolean = false;
  contacts: Array<UserResponse> = [];
  chatSelected= output<ChatResponse>();
  setNewChat = output<ChatResponse>();
  currentUserId: string = '';
  // currentUser = input<UserResponse | null>(null);

  constructor(
    private api: Api,
    private keycloakService: KeycloakService
  ) {}

  ngOnInit(): void {
    this.getCurrentUserId(this.keycloakService.userId);     // 1st
  }

  private getCurrentUserId(kecloakId: string) {
    from(this.api.invoke(findUserByKeycloakId, { "keycloak-id": kecloakId }))
      .subscribe(user => this.currentUserId = user.id as string);
  }

  async searchContact() {
    try {
      const users = await this.api.invoke(findAllUsers);
      this.contacts = users;
    } catch (error) {
      console.error('Error fetching users:', error);
    }
    this.searchNewContact = true;
  }

  wrapMessage(message: string | undefined): string {
    if (!message) return '';
    return message.length <= 20
      ? message
      : message.substring(0, 20) + '...';
  }

  formatMessageDateTime(date: string | undefined): string {
    if (!date) return '';

    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const now = new Date();

    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const isYesterday =
      new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
        .toDateString() === d.toDateString();

    if (isToday) {
      return new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(d);
    }

    if (isYesterday) {
      return 'Yesterday';
    }

    return new Intl.DateTimeFormat('en-GB').format(d);
  }

  private setMessagesAsRead(chatId: string) {
    if (!chatId) return;
    return from(
      this.api.invoke(markMessageAsRead, { "chat-id": chatId })
    ).pipe(
      take(1)
    );
  }

  chatClicked(chat: ChatResponse) {
    this.chatSelected.emit(chat);
    this.setMessagesAsRead(chat.id??'')?.subscribe();
  }

  contactClicked(contact: UserResponse) {
    from(this.api.invoke(createChat, {
      "sender-id": this.keycloakService.userId,
      "receiver-id": contact.keycloakId ?? ''
    })).subscribe({
      next: (res) => {
        const chat: ChatResponse = {
          id: res.chatId,
          name: contact.firstName + ' ' + contact.lastName,
          lastMessage: '',
          unreadCount: 0,
          currentUserId: this.currentUserId,
          // currentUserId: this.currentUser()?.id,
          otherUserId: contact.id ?? '',
          recipientOnline: contact.online ?? false,
          lastMessageTime: new Date().toISOString()
        }
        this.setNewChat.emit(chat);
        this.searchNewContact = false;
        this.chatSelected.emit(chat);
      }
    })
  }

}
