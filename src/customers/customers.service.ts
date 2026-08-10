import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface CustomerQueryDto {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
}

@Injectable()
export class CustomersService {
  constructor(private readonly supabaseService: SupabaseService) { }

  async getAdminCustomers(query: CustomerQueryDto) {
    const client = this.supabaseService.admin;
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.max(1, parseInt(query.limit || '10', 10));
    const search = (query.search || '').trim().toLowerCase();
    const status = query.status || 'all';

    try {
      // 1. Fetch users from Supabase Auth
      const { data, error } = await client.auth.admin.listUsers();
      if (error) {
        throw new InternalServerErrorException(error.message);
      }

      const rawUsers = data?.users || [];

      // 2. Fetch order counts per user from orders table
      const { data: orderRows } = await client
        .from('orders')
        .select('user_id');

      const orderCountsMap: Record<string, number> = {};
      if (Array.isArray(orderRows)) {
        orderRows.forEach((row: { user_id?: string }) => {
          if (row.user_id) {
            orderCountsMap[row.user_id] = (orderCountsMap[row.user_id] || 0) + 1;
          }
        });
      }

      // 3. Filter only accounts with user/customer role (exclude admins)
      const userAccounts = rawUsers.filter((user) => {
        const appMeta = user.app_metadata || {};
        const userMeta = user.user_metadata || {};
        const role = (appMeta.role || userMeta.role || user.role || 'user').toLowerCase();

        // Exclude any account marked as admin or superadmin
        if (
          role === 'admin' ||
          role === 'superadmin' ||
          appMeta.is_admin === true ||
          userMeta.is_admin === true
        ) {
          return false;
        }
        return true;
      });

      // 4. Map users to Customer format
      let customers = userAccounts.map((user) => {
        const meta = user.user_metadata || {};
        const isBanned = user.banned_until ? new Date(user.banned_until) > new Date() : false;
        const isDisabled = Boolean(isBanned || meta.is_disabled);

        const fullName =
          meta.full_name ||
          meta.name ||
          (user.email ? user.email.split('@')[0] : 'User');
        const phone = user.phone || meta.phone || '';

        return {
          id: user.id,
          full_name: fullName,
          email: user.email || '',
          phone_number: phone,
          orders_count: orderCountsMap[user.id] || 0,
          created_at: user.created_at,
          is_disabled: isDisabled,
        };
      });

      // 4. Filter by search query
      if (search) {
        customers = customers.filter(
          (c) =>
            c.id.toLowerCase().includes(search) ||
            c.full_name.toLowerCase().includes(search) ||
            c.email.toLowerCase().includes(search) ||
            c.phone_number.toLowerCase().includes(search)
        );
      }

      // 5. Filter by status
      if (status !== 'all') {
        const isTargetDisabled = status === 'disabled';
        customers = customers.filter((c) => c.is_disabled === isTargetDisabled);
      }

      const total = customers.length;
      const startIndex = (page - 1) * limit;
      const paginatedItems = customers.slice(startIndex, startIndex + limit);

      return {
        items: paginatedItems,
        total,
      };
    } catch (err: any) {
      console.error('Error fetching admin customers:', err);
      throw new InternalServerErrorException('Failed to fetch customers list');
    }
  }

  async toggleDisableCustomer(userId: string, isDisabled: boolean) {
    const client = this.supabaseService.admin;

    try {
      const banDuration = isDisabled ? '876000h' : 'none';

      const { data, error } = await client.auth.admin.updateUserById(userId, {
        ban_duration: banDuration,
        user_metadata: { is_disabled: isDisabled },
      });

      if (error) {
        throw new InternalServerErrorException(error.message);
      }

      const user = data.user;
      const meta = user.user_metadata || {};
      const fullName =
        meta.full_name ||
        meta.name ||
        (user.email ? user.email.split('@')[0] : 'User');

      return {
        success: true,
        customer: {
          id: user.id,
          full_name: fullName,
          email: user.email || '',
          phone_number: user.phone || meta.phone || '',
          orders_count: 0,
          created_at: user.created_at,
          is_disabled: isDisabled,
        },
      };
    } catch (err: any) {
      console.error(`Error toggling disable status for user ${userId}:`, err);
      throw new InternalServerErrorException('Failed to update customer status');
    }
  }
}
