import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IUserRepository } from '../../../domain/repositories';
import { User, UserRole } from '../../../domain/entities';
import { UserDocument } from '../schemas/user.schema';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectModel(UserDocument.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const user = new this.userModel(data);
    const saved = await user.save();
    return this.toEntity(saved);
  }

  async findById(id: string): Promise<User | null> {
    const user = await this.userModel.findById(id).exec();
    return user ? this.toEntity(user) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.userModel.findOne({ email }).exec();
    return user ? this.toEntity(user) : null;
  }

  async findAll(): Promise<User[]> {
    const users = await this.userModel.find().exec();
    return users.map((user) => this.toEntity(user));
  }

  async update(id: string, data: Partial<User>): Promise<User | null> {
    const user = await this.userModel
      .findByIdAndUpdate(id, data, { returnDocument: 'after' })
      .exec();
    return user ? this.toEntity(user) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.userModel.findByIdAndDelete(id).exec();
    return !!result;
  }

  async findByRole(role: UserRole): Promise<User[]> {
    const users = await this.userModel.find({ role }).exec();
    return users.map((user) => this.toEntity(user));
  }

  private toEntity(doc: any): User {
    return {
      id: doc._id.toString(),
      name: doc.name,
      email: doc.email,
      passwordHash: doc.passwordHash,
      role: doc.role,
      isActive: doc.isActive,
      mustChangePassword: doc.mustChangePassword ?? true,
      createdAt: doc.createdAt || new Date(),
      updatedAt: doc.updatedAt || new Date(),
    };
  }
}
