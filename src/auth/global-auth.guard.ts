import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { User } from '../user/user.entity.js';

@Injectable()
export class GlobalAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = User>(
    err: Error | null,
    user: TUser | null,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _info: unknown,
  ): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid or missing token');
    }
    return user;
  }
}
