import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from './orders.service';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Roles(UserRole.STUDENT)
  create(
    @Body() createOrderDto: CreateOrderDto,
    @Req() request: Request & { user: CurrentUser },
  ) {
    return this.ordersService.create(createOrderDto, request.user);
  }

  @Get()
  findAll(@Req() request: Request & { user: CurrentUser }) {
    return this.ordersService.findAll(request.user);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request & { user: CurrentUser },
  ) {
    return this.ordersService.findOne(id, request.user);
  }

  @Get(':id/items')
  findOrderItems(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request & { user: CurrentUser },
  ) {
    return this.ordersService.findOrderItems(id, request.user);
  }

  @Patch(':id/status')
  @Roles(UserRole.STAFF)
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStatusDto: UpdateOrderStatusDto,
    @Req() request: Request & { user: CurrentUser },
  ) {
    return this.ordersService.updateStatus(id, updateStatusDto, request.user);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request & { user: CurrentUser },
  ) {
    return this.ordersService.remove(id, request.user);
  }
}
