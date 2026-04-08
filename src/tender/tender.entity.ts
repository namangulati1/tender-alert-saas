import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('tenders')
export class Tender {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  source: string;

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'text' })
  raw_text: string;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  budget: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  deadline: Date | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64, unique: true })
  hash: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
