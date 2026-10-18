export const prerender = false;
import type { APIRoute } from 'astro';
import { handlePaymentProxy } from '../../../../lib/payment-proxy.ts';
export const POST: APIRoute = ({ request, cookies }) => handlePaymentProxy({ request, cookies, authorize: true });
