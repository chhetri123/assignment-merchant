import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  // passwordHash is `select: false`, so it must be asked for explicitly.
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.users.findOne({
      where: { email: email.toLowerCase() },
      select: ['id', 'email', 'fullName', 'role', 'isActive', 'passwordHash'],
    });
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  findActiveByIdAndRole(id: string, role: UserRole): Promise<User | null> {
    return this.users.findOne({ where: { id, role, isActive: true } });
  }
}
