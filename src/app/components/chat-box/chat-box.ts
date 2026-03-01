import { Component, input, output } from '@angular/core';
import { ChatResponse, MessageRequest, MessageResponse, UserResponse } from '../../api/models';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import { FormsModule } from '@angular/forms';
import { Api } from '../../api/api';
import { from } from 'rxjs';
import { DatePipe } from '@angular/common';
import { saveMessage } from '../../api/functions';

@Component({
  selector: 'app-chat-box',
  imports: [PickerComponent, FormsModule, DatePipe],
  templateUrl: './chat-box.html',
  styleUrl: './chat-box.scss',
})
export class ChatBox {

  chat = input<ChatResponse>({});
  showEmojis: boolean = false;
  messageContent: string = '';
  messages = input<MessageResponse[]>([]);
  setNewMessage = output<MessageResponse>();
  updateLastMessage = output<string>();

  constructor(
    private api: Api
  ) {}

  currentUser?: UserResponse;

  ngOnInit() {
    
  }



  isSelfMessage(message: MessageResponse): boolean {
    return message.senderId === this.chat().currentUserId;
  }

  toggleEmojis() {
    this.showEmojis = !this.showEmojis;
  }

  uploadFile(event: EventTarget | null) {
    
  }

  emojiSelected(emojiSelected: any) {
    const emoji = emojiSelected.emoji.native;
    this.messageContent += emoji;
  }

  sendMessage() {
    if (!this.messageContent.trim()) return;
    // Implement the logic to send the message
    const newMessage: MessageRequest = {
      chatId: this.chat().id,
      content: this.messageContent,
      type: 'TEXT',
    };
    from(this.api.invoke(saveMessage, { body: newMessage } ))
      .subscribe({
        next: () => {
          const messageResponse: MessageResponse = {
            content: this.messageContent,
            senderId: this.chat().currentUserId,
            receiverId: this.chat().otherUserId,
            createdAt: new Date().toISOString(),
            type: 'TEXT',
            state: 'SENT'
          }
          this.setNewMessage.emit(messageResponse);
          this.messageContent = '';
          this.updateLastMessage.emit(messageResponse.content ?? '');
          this.showEmojis = false;
        }
      });
  }

  keyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      // event.preventDefault();
      this.sendMessage();
    }
  }

  onClick(){}

}
