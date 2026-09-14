import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../transactions/transaction.entity';
import { VulnTestController } from './vuln-test.controller';
import { VulnTestService } from './vuln-test.service';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction])],
  controllers: [VulnTestController],
  providers: [VulnTestService],
})
export class VulnTestModule {}
