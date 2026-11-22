import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
  ) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const category = this.categoriesRepository.create(createCategoryDto);
    try {
      return await this.categoriesRepository.save(category);
    } catch (error) {
      this.throwCategoryDatabaseConflict(error);
    }
  }

  findAll(): Promise<Category[]> {
    return this.categoriesRepository.find();
  }

  async findOne(id: number): Promise<Category> {
    const category = await this.categoriesRepository.findOne({
      where: { categoryId: id },
      relations: { products: true },
    });
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    return category;
  }

  async update(
    id: number,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    const category = await this.categoriesRepository.findOne({
      where: { categoryId: id },
    });
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    Object.assign(category, updateCategoryDto);
    try {
      return await this.categoriesRepository.save(category);
    } catch (error) {
      this.throwCategoryDatabaseConflict(error);
    }
  }

  async remove(id: number): Promise<{ message: string }> {
    const category = await this.categoriesRepository.findOne({
      where: { categoryId: id },
    });
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    try {
      await this.categoriesRepository.remove(category);
    } catch (error) {
      if (this.isRestrictDeleteError(error)) {
        throw new ConflictException(
          'Category cannot be deleted because it is being used by products',
        );
      }
      throw error;
    }
    return { message: 'Category deleted successfully' };
  }

  private throwCategoryDatabaseConflict(error: unknown): never {
    if (this.isDuplicateEntryError(error)) {
      throw new ConflictException('A category with this name already exists');
    }
    throw error;
  }

  private isDuplicateEntryError(error: unknown): boolean {
    const databaseError = error as { code?: string; errno?: number };
    return (
      databaseError.code === 'ER_DUP_ENTRY' ||
      databaseError.errno === 1062
    );
  }

  private isRestrictDeleteError(error: unknown): boolean {
    const databaseError = error as { code?: string; errno?: number };
    return (
      databaseError.code === 'ER_ROW_IS_REFERENCED_2' ||
      databaseError.code === 'ER_ROW_IS_REFERENCED' ||
      databaseError.errno === 1451
    );
  }
}
