import { Controller, Get, Post, Put, Delete, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('addresses')
@UseGuards(SupabaseAuthGuard)
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  async getAddresses(@CurrentUser() user: any) {
    return this.addressesService.getAddresses(user.sub);
  }

  @Post()
  async createAddress(@CurrentUser() user: any, @Body() dto: CreateAddressDto) {
    return this.addressesService.createAddress(user.sub, dto);
  }

  @Put(':id')
  async updateAddress(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.addressesService.updateAddress(user.sub, id, dto);
  }

  @Delete(':id')
  async deleteAddress(@CurrentUser() user: any, @Param('id') id: string) {
    return this.addressesService.deleteAddress(user.sub, id);
  }

  @Patch(':id/default')
  async setDefaultAddress(@CurrentUser() user: any, @Param('id') id: string) {
    return this.addressesService.setDefaultAddress(user.sub, id);
  }
}
