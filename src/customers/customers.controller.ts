import { Controller, Get, Patch, Query, Param, Body } from '@nestjs/common';
import { CustomersService, CustomerQueryDto } from './customers.service';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) { }

  @Get('admin')
  async getAdminCustomers(@Query() query: CustomerQueryDto) {
    return this.customersService.getAdminCustomers(query);
  }

  @Patch('admin/:id/toggle-disable')
  async toggleDisableCustomer(
    @Param('id') id: string,
    @Body('is_disabled') isDisabled: boolean,
  ) {
    return this.customersService.toggleDisableCustomer(id, Boolean(isDisabled));
  }
}
