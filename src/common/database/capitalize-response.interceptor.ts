import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class CapitalizeInterceptor implements NestInterceptor {
  private readonly exceptions = ['email','id','path'];

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => this.capitalizeResponse(data)));
  }

  private capitalizeResponse(data: any, seen = new WeakSet()): any {
    if (data instanceof Date) return data;
    if (Array.isArray(data)) {
      return data.map(item => this.capitalizeObject(item, seen));
    } else if (data && typeof data === 'object') {
      return this.capitalizeObject(data, seen);
    }
    return data;
  }

  private capitalizeObject(obj: Record<string, any>, seen: WeakSet<any>): Record<string, any> {
    if (typeof obj === 'string') return obj;
    if (seen.has(obj)) return obj; // prevent circular reference
    seen.add(obj);

    const result: Record<string, any> = {};

    for (const key of Object.keys(obj)) {
      const value = obj[key];

      if (typeof value === 'string') {
        if (this.exceptions.includes(key)) {
          result[key] = value;
        } else if (value.length > 0) {
          result[key] = value.charAt(0).toUpperCase() + value.slice(1);
        } else {
          result[key] = value;
        }
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.capitalizeResponse(value, seen); // recursive
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  // ---------------- STATIC UTILITY ----------------
  static capitalizeData(data: any, exceptions: string[] = ['email'], seen = new WeakSet()): any {
    if (data instanceof Date) return data;
    if (Array.isArray(data)) {
      return data.map(item => this.capitalizeObjectStatic(item, exceptions, seen));
    } else if (data && typeof data === 'object') {
      return this.capitalizeObjectStatic(data, exceptions, seen);
    }
    return data;
  }

  private static capitalizeObjectStatic(
    obj: Record<string, any>,
    exceptions: string[],
    seen: WeakSet<any>
  ): Record<string, any> {
    if (typeof obj === 'string') return obj;
    if (seen.has(obj)) return obj; // prevent circular reference
    seen.add(obj);

    const result: Record<string, any> = {};

    for (const key of Object.keys(obj)) {
      const value = obj[key];

      if (typeof value === 'string') {
        if (exceptions.includes(key)) {
          result[key] = value;
        } else if (value.length > 0) {
          result[key] = value.charAt(0).toUpperCase() + value.slice(1);
        } else {
          result[key] = value;
        }
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.capitalizeData(value, exceptions, seen);
      } else {
        result[key] = value;
      }
    }

    return result;
  }
}
