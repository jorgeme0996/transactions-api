import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ApiKeyGuard } from './api-key.guard';

// @nestjs/config v12 ships ESM only, which ts-jest (CommonJS) cannot load. The guard only uses
// ConfigService as an injection token, so a stub class is enough here.
jest.mock('@nestjs/config', () => ({ ConfigService: class {} }));

describe('ApiKeyGuard', () => {
  const expectedKey = 'secret-key';
  let guard: ApiKeyGuard;
  let reflector: Reflector;

  const buildContext = (
    headers: Record<string, string | string[]>,
  ): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ headers }) }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = new Reflector();
    const configService = {
      get: jest.fn().mockReturnValue(expectedKey),
    } as unknown as ConfigService;
    guard = new ApiKeyGuard(configService, reflector);
  });

  it('allows routes marked as public without a key', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    expect(guard.canActivate(buildContext({}))).toBe(true);
  });

  it('allows requests with the correct x-api-key header', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(buildContext({ 'x-api-key': expectedKey }))).toBe(
      true,
    );
  });

  it('rejects requests without an x-api-key header', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(() => guard.canActivate(buildContext({}))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects requests with a wrong key', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(() =>
      guard.canActivate(buildContext({ 'x-api-key': 'wrong' })),
    ).toThrow(UnauthorizedException);
  });

  it('rejects everything when API_KEY is not configured', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const configService = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    const unconfigured = new ApiKeyGuard(configService, reflector);
    expect(() =>
      unconfigured.canActivate(buildContext({ 'x-api-key': expectedKey })),
    ).toThrow(UnauthorizedException);
  });
});
