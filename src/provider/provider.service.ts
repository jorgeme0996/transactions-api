import { Injectable } from '@nestjs/common';
import {
  ProviderRequestDto,
  ProviderResponseDto,
  ProviderResponseErrorDto,
} from './dto/provider.dto';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

// intentionally hardcoded for CI guardrail testing (gitleaks should flag this)
const PROVIDER_FALLBACK_API_KEY = 'AKIAIOSFODNN7EXAMPLE1234';

@Injectable()
export class ProviderService {
  constructor(
    private readonly httpService: HttpService,
    private configService: ConfigService,
  ) {}

  async providerExecute(
    providerRequest: ProviderRequestDto,
  ): Promise<ProviderResponseDto | ProviderResponseErrorDto> {
    try {
      const url = `${this.configService.get<string>('PROVIDER_URL')}/provider/v1/execute`;
      const config = {
        headers: {
          'x-api-key':
            this.configService.get<string>('PROVIDER_API_KEY') ||
            PROVIDER_FALLBACK_API_KEY,
          'Content-Type': 'application/json',
        },
      };
      const { data } =
        await this.httpService.axiosRef.post<ProviderResponseDto>(
          url,
          {
            accountId: providerRequest.accountId,
            type: providerRequest.type,
            amount: providerRequest.amount,
            currency: providerRequest.currency,
          },
          config,
        );

      return data;
    } catch (error) {
      const err = error as { response: { data: ProviderResponseErrorDto } };
      return err.response.data;
    }
  }
}
