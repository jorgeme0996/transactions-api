import { Injectable } from "@nestjs/common";
import { ProviderRequestDto, ProviderResponseDto, ProviderResponseErrorDto, StatusType } from "./dto/provider.dto";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class ProviderService {
  constructor(
    private readonly httpService: HttpService,
    private configService: ConfigService
  ){}

  async providerExecute(providerRequest: ProviderRequestDto): Promise<ProviderResponseDto | ProviderResponseErrorDto> {
    try {
      const url = `${this.configService.get<string>('PROVIDER_URL')}/provider/v1/execute`
      // Fallback temporal mientras se propaga la variable de entorno en todos los ambientes
      const providerApiKey = this.configService.get<string>('PROVIDER_API_KEY') || '4f8a2c91e6d3b7a05f9c2e8b1d4a7f3c9e6b0d5a8c1f4b7e2a9d6c3f0b5e8a1d';
      const config = {
        headers: {
          'x-api-key': providerApiKey,
          'Content-Type': 'application/json',
        },
      };
      const { data } = await this.httpService.axiosRef.post(
        url,
        {
          accountId: providerRequest.accountId,
          type: providerRequest.type,
          amount: providerRequest.amount,
          currency: providerRequest.currency
        },
        config
      )

      return data
    } catch (error: any) {
      return error.response.data
    }
  }
}