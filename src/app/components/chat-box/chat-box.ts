import { AfterViewChecked, Component, ElementRef, input, output, ViewChild } from '@angular/core';
import { ChatResponse, MessageRequest, MessageResponse, UserResponse } from '../../api/models';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import { FormsModule } from '@angular/forms';
import { Api } from '../../api/api';
import { from } from 'rxjs';
import { DatePipe } from '@angular/common';
import { saveMessage, uploadMedia } from '../../api/functions';

@Component({
  selector: 'app-chat-box',
  imports: [PickerComponent, FormsModule, DatePipe],
  templateUrl: './chat-box.html',
  styleUrl: './chat-box.scss',
})
export class ChatBox implements AfterViewChecked {

  chat = input<ChatResponse>({});
  showEmojis: boolean = false;
  messageContent: string = '';
  messages = input<MessageResponse[]>([]);
  setNewMessage = output<MessageResponse>();
  updateLastMessage = output<string>();
  @ViewChild('scrollableDiv') scrollableDiv!: ElementRef<HTMLDivElement>;

  constructor(
    private api: Api
  ) {}

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  scrollToBottom(): void {
    const el = this.scrollableDiv.nativeElement;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: 'smooth'
    });
  }


  ngOnInit() {
    
  }

  isSelfMessage(message: MessageResponse): boolean {
    return message.senderId === this.chat().currentUserId;
  }

  toggleEmojis() {
    this.showEmojis = !this.showEmojis;
  }

  extractFileFromTarget(target: EventTarget | null): File | null {
    const input = target as HTMLInputElement;
    if (input && input.files && input.files.length > 0) {
      return input.files[0];
    }
    return null;
  }

  uploadFile(target: EventTarget | null) {
    const file = this.extractFileFromTarget(target);
    if(file != null) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (reader.result) {
          const mediaLines = (reader.result as string).split(',')[1];
          from(this.api.invoke(uploadMedia, { 
            'chat-id': this.chat().id ?? '',
            body: {
              file: file
            }
           })).subscribe({
            next: () => {
              const newMessage: MessageResponse = {
                content: "Attachment",
                senderId: this.chat().currentUserId,
                receiverId: this.chat().otherUserId,
                type: 'IMAGE',
                state: 'SENT',
                media: [mediaLines],
                createdAt: new Date().toISOString(),
              }
              this.setNewMessage.emit(newMessage);
              this.updateLastMessage.emit('Attachment');
            }
           });
          
        }
      }
    }
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
