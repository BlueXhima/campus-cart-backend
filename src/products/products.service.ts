import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { Product } from './entities/product.entity';
import { Category } from '../categories/entities/category.entity';

export interface PaginatedProducts {
  data: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class ProductsService {
  private readonly pageSize = 10;

  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const category = await this.validateCategory(createProductDto.categoryId);
    const product = this.productsRepository.create({
      ...createProductDto,
      category,
    });
    return this.productsRepository.save(product);
  }

  async findAll(query: QueryProductDto = {}): Promise<PaginatedProducts> {
    const page = query.page ?? 1;
    const [data, total] = await this.productsRepository.findAndCount({
      where: query.categoryId ? { categoryId: query.categoryId } : undefined,
      relations: { category: true },
      skip: (page - 1) * this.pageSize,
      take: this.pageSize,
    });
    return {
      data,
      total,
      page,
      limit: this.pageSize,
      totalPages: Math.ceil(total / this.pageSize),
    };
  }

  async findOne(id: number): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { productId: id },
      relations: { category: true },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async update(
    id: number,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { productId: id },
      relations: { category: true },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    if (updateProductDto.categoryId !== undefined) {
      const category = await this.validateCategory(
        updateProductDto.categoryId,
      );
      Object.assign(product, updateProductDto, { category });
    } else {
      Object.assign(product, updateProductDto);
    }

    return this.productsRepository.save(product);
  }

  async remove(id: number): Promise<{ message: string }> {
    const product = await this.productsRepository.findOne({
      where: { productId: id },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    try {
      await this.productsRepository.remove(product);
    } catch (error) {
      const databaseError = error as { code?: string; errno?: number };
      if (
        databaseError.code === 'ER_ROW_IS_REFERENCED_2' ||
        databaseError.code === 'ER_ROW_IS_REFERENCED' ||
        databaseError.errno === 1451
      ) {
        throw new ConflictException(
          'Product cannot be deleted because it is referenced by other records',
        );
      }
      throw error;
    }
    return { message: 'Product deleted successfully' };
  }

  private async validateCategory(categoryId: number): Promise<Category> {
    const category = await this.categoriesRepository.findOne({
      where: { categoryId },
    });
    if (!category) {
      throw new NotFoundException(
        `Category with ID ${categoryId} not found`,
      );
    }
    return category;
  }
}
