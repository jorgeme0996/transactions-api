import { Module } from '@nestjs/common';
import { ProviderService } from './provider.service';
import { HttpModule } from '@nestjs/axios';


@Module({
  imports: [HttpModule],
  controllers: [],
  providers: [ProviderService],
  exports: [ProviderService],
})
export class ProviderModule {}
