import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../user/user.entity.js';
import { Tender } from '../tender/tender.entity.js';

export enum DeliveryStatus {
  QUEUED = 'queued',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
}

@Entity('notifications_log')
export class NotificationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid' })
  tender_id: string;

  @ManyToOne(() => Tender, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tender_id' })
  tender: Tender;

  @Column({
    type: 'enum',
    enum: DeliveryStatus,
    default: DeliveryStatus.QUEUED,
  })
  delivery_status: DeliveryStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  sent_at: Date;
}
