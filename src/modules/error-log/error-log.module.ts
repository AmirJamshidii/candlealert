import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErrorLogEntity } from './error-log.entity';
import { ErrorLogService } from './error-log.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ErrorLogEntity])],
  providers: [ErrorLogService],
  exports: [ErrorLogService],
})
export class ErrorLogModule {}
