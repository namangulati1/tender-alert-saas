import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../user/user.entity.js';

export enum RazorpaySubscriptionStatus {
  CREATED = 'created',
  AUTHENTICATED = 'authenticated',
  ACTIVE = 'active',
  PAUSED = 'paused',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 255 })
  razorpay_subscription_id: string;

  @Column({
    type: 'enum',
    enum: RazorpaySubscriptionStatus,
    default: RazorpaySubscriptionStatus.CREATED,
  })
  status: RazorpaySubscriptionStatus;

  @Column({ type: 'timestamptz', nullable: true })
  start_date: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  end_date: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
