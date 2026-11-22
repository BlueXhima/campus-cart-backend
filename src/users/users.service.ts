import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<Omit<User, 'passwordHash'>> {
    const existingUser = await this.usersRepository.findOne({
      where: { email: createUserDto.email },
    });
    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    const { password, ...userFields } = createUserDto;
    const user = this.usersRepository.create({
      ...userFields,
      passwordHash: await bcrypt.hash(password, 10),
    });
    const savedUser = await this.usersRepository.save(user);
    return this.withoutPasswordHash(savedUser);
  }

  async findAll(): Promise<Omit<User, 'passwordHash'>[]> {
    const users = await this.usersRepository.find();
    return users.map((user) => this.withoutPasswordHash(user));
  }

  async findOne(id: number): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.usersRepository.findOne({ where: { userId: id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return this.withoutPasswordHash(user);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async update(
    id: number,
    updateUserDto: UpdateUserDto,
  ): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.usersRepository.findOne({ where: { userId: id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const { password, ...userFields } = updateUserDto;
    Object.assign(user, userFields);
    if (password !== undefined) {
      user.passwordHash = await bcrypt.hash(password, 10);
    }

    const savedUser = await this.usersRepository.save(user);
    return this.withoutPasswordHash(savedUser);
  }

  async remove(id: number): Promise<{ message: string }> {
    const user = await this.usersRepository.findOne({ where: { userId: id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    await this.usersRepository.remove(user);
    return { message: 'User deleted successfully' };
  }

  private withoutPasswordHash(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash, ...safeUser } = user;
    void passwordHash;
    return safeUser;
  }
}
