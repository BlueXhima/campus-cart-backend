import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Product } from '../products/entities/product.entity';
import { UserRole, User } from '../users/entities/user.entity';

export interface CurrentUser {
  userId: number;
  email: string;
  role: UserRole;
}

@Injectable()
export class OrdersService {
  constructor(private readonly dataSource: DataSource) {}

  async create(
    createOrderDto: CreateOrderDto,
    currentUser: CurrentUser,
  ): Promise<Order> {
    const quantities = new Map<number, number>();
    for (const item of createOrderDto.items) {
      quantities.set(
        item.productId,
        (quantities.get(item.productId) ?? 0) + item.quantity,
      );
    }
    const normalizedItems = [...quantities.entries()]
      .map(([productId, quantity]) => ({ productId, quantity }))
      .sort((a, b) => a.productId - b.productId);
    const productIds = normalizedItems.map((item) => item.productId);

    let savedOrderId: number | undefined;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        savedOrderId = await this.dataSource.transaction(async (manager) => {
          const productRepository = manager.getRepository(Product);
          const products = await productRepository
            .createQueryBuilder('product')
            .where('product.productId IN (:...productIds)', { productIds })
            .orderBy('product.productId', 'ASC')
            .setLock('pessimistic_write')
            .getMany();

          const productsById = new Map(
            products.map((product) => [product.productId, product]),
          );
          let totalCents = 0;
          const orderItems: OrderItem[] = [];

          for (const item of normalizedItems) {
            const product = productsById.get(item.productId);
            if (!product) {
              throw new NotFoundException(
                `Product with ID ${item.productId} not found`,
              );
            }
            if (product.stockCount < item.quantity) {
              throw new ConflictException(
                `Insufficient stock for "${product.productName}": ${product.stockCount} available`,
              );
            }

            product.stockCount -= item.quantity;
            await productRepository.save(product);

            const priceCents = Math.round(Number(product.price) * 100);
            totalCents += priceCents * item.quantity;

            const orderItem = manager.getRepository(OrderItem).create({
              productId: product.productId,
              quantity: item.quantity,
              priceAtPurchase: Number((priceCents / 100).toFixed(2)),
            });
            orderItems.push(orderItem);
          }

          const pickupCode = `CC-${randomBytes(3).toString('hex').toUpperCase()}`;
          const order = manager.getRepository(Order).create({
            userId: currentUser.userId,
            totalAmount: Number((totalCents / 100).toFixed(2)),
            orderStatus: OrderStatus.PENDING,
            pickupCode,
          });
          const savedOrder = await manager.getRepository(Order).save(order);

          for (const orderItem of orderItems) {
            orderItem.orderId = savedOrder.orderId;
          }
          await manager.getRepository(OrderItem).save(orderItems);
          return savedOrder.orderId;
        });
        break;
      } catch (error) {
        if (!this.isDuplicateEntryError(error) || attempt === 4) {
          throw error;
        }
      }
    }

    if (savedOrderId === undefined) {
      throw new ConflictException('Unable to generate a unique pickup code');
    }
    const savedOrder = await this.dataSource
      .getRepository(Order)
      .findOne({
        where: { orderId: savedOrderId },
        relations: { user: true, orderItems: { product: true } },
      });
    if (!savedOrder) {
      throw new NotFoundException(`Order with ID ${savedOrderId} not found`);
    }
    return this.withoutPasswordHash(savedOrder);
  }

  async findAll(currentUser: CurrentUser): Promise<Order[]> {
    const orders = await this.dataSource.getRepository(Order).find({
      where:
        currentUser.role === UserRole.STAFF
          ? undefined
          : { userId: currentUser.userId },
      relations: { user: true, orderItems: { product: true } },
      order: { orderDate: 'DESC' },
    });
    return orders.map((order) => this.withoutPasswordHash(order));
  }

  async findOne(id: number, currentUser: CurrentUser): Promise<Order> {
    const order = await this.getAccessibleOrder(id, currentUser);
    return this.withoutPasswordHash(order);
  }

  async findOrderItems(
    orderId: number,
    currentUser: CurrentUser,
  ): Promise<OrderItem[]> {
    await this.getAccessibleOrder(orderId, currentUser);
    return this.dataSource.getRepository(OrderItem).find({
      where: { orderId },
      relations: { product: true },
    });
  }

  async updateStatus(
    id: number,
    updateStatusDto: UpdateOrderStatusDto,
    currentUser: CurrentUser,
  ): Promise<Order> {
    void currentUser;
    const order = await this.dataSource.getRepository(Order).findOne({
      where: { orderId: id },
      relations: { user: true, orderItems: { product: true } },
    });
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    if (
      order.orderStatus === OrderStatus.PAID_AND_CLAIMED &&
      updateStatusDto.orderStatus !== OrderStatus.PAID_AND_CLAIMED
    ) {
      throw new BadRequestException(
        'A Paid & Claimed order cannot change status',
      );
    }
    if (
      order.orderStatus === OrderStatus.READY_FOR_PICKUP &&
      updateStatusDto.orderStatus === OrderStatus.PENDING
    ) {
      throw new BadRequestException(
        'An order cannot move backwards from Ready for Pickup to Pending',
      );
    }

    order.orderStatus = updateStatusDto.orderStatus;
    const savedOrder = await this.dataSource
      .getRepository(Order)
      .save(order);
    return this.withoutPasswordHash(savedOrder);
  }

  async remove(
    id: number,
    currentUser: CurrentUser,
  ): Promise<{ message: string }> {
    await this.dataSource.transaction(async (manager) => {
      const order = await manager
        .getRepository(Order)
        .createQueryBuilder('order')
        .where('order.orderId = :id', { id })
        .setLock('pessimistic_write')
        .getOne();

      if (!order) {
        throw new NotFoundException(`Order with ID ${id} not found`);
      }
      if (currentUser.role !== UserRole.STAFF) {
        if (order.userId !== currentUser.userId) {
          throw new ForbiddenException(
            'You do not have permission to access this resource',
          );
        }
        if (order.orderStatus !== OrderStatus.PENDING) {
          throw new BadRequestException(
            'Students can only cancel Pending orders',
          );
        }
      }
      if (order.orderStatus === OrderStatus.PAID_AND_CLAIMED) {
        throw new BadRequestException(
          'A completed Paid & Claimed order cannot be deleted',
        );
      }

      await this.restoreStock(manager, order.orderId);
      await manager.getRepository(Order).remove(order);
    });

    return { message: 'Order deleted successfully' };
  }

  private async getAccessibleOrder(
    id: number,
    currentUser: CurrentUser,
  ): Promise<Order> {
    const order = await this.dataSource.getRepository(Order).findOne({
      where: { orderId: id },
      relations: { user: true, orderItems: { product: true } },
    });
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    if (
      currentUser.role !== UserRole.STAFF &&
      order.userId !== currentUser.userId
    ) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }
    return order;
  }

  private async restoreStock(
    manager: EntityManager,
    orderId: number,
  ): Promise<void> {
    const orderItems = await manager
      .getRepository(OrderItem)
      .createQueryBuilder('orderItem')
      .where('orderItem.orderId = :orderId', { orderId })
      .orderBy('orderItem.productId', 'ASC')
      .getMany();

    const productIds = [
      ...new Set(orderItems.map((orderItem) => orderItem.productId)),
    ].sort((a, b) => a - b);
    if (productIds.length === 0) {
      return;
    }

    const products = await manager
      .getRepository(Product)
      .createQueryBuilder('product')
      .where('product.productId IN (:...productIds)', { productIds })
      .orderBy('product.productId', 'ASC')
      .setLock('pessimistic_write')
      .getMany();
    const productsById = new Map(
      products.map((product) => [product.productId, product]),
    );
    for (const orderItem of orderItems) {
      const product = productsById.get(orderItem.productId);
      if (product) {
        product.stockCount += orderItem.quantity;
      }
    }
    await manager.getRepository(Product).save([...productsById.values()]);
  }

  private withoutPasswordHash(order: Order): Order {
    if (order.user) {
      delete (order.user as Partial<User>).passwordHash;
    }
    return order;
  }

  private isDuplicateEntryError(error: unknown): boolean {
    const databaseError = error as { code?: string; errno?: number };
    return (
      databaseError.code === 'ER_DUP_ENTRY' ||
      databaseError.errno === 1062
    );
  }
}
