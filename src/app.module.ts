import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TransactionsModule } from './transactions/transactions.module';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppDataSource } from './config/typeorm.config';
import { AuthModule } from './auth/auth.module';
import { VulnTestModule } from './vuln-test/vuln-test.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Makes the ConfigService available across all your modules
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({}),
      dataSourceFactory: async () => {
        if (!AppDataSource.isInitialized) {
          await AppDataSource.initialize();
        }

        return AppDataSource;
      },
    }),
    AuthModule,
    TransactionsModule,
    VulnTestModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
