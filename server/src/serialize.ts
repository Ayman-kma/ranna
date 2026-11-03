import { getMerchantById, type MerchantRow, type OrderRow, type StaffRow } from './db';

export function merchantSummary(merchant: MerchantRow) {
  return {
    id: merchant.id,
    nameAr: merchant.name_ar,
    nameEn: merchant.name_en,
    slug: merchant.slug,
    logo: merchant.logo,
    color: merchant.color,
    googleReviewUrl: merchant.google_review_url,
  };
}

export function serializeStaff(staff: StaffRow) {
  const merchant = getMerchantById(staff.merchant_id);
  return {
    id: staff.id,
    name: staff.name,
    email: staff.email,
    role: staff.role,
    merchant: merchant ? merchantSummary(merchant) : null,
  };
}

/** Shape shown to the customer (no internal ids, no token). */
export function publicOrder(order: OrderRow) {
  const merchant = getMerchantById(order.merchant_id);
  return {
    number: order.number,
    status: order.status,
    customerLabel: order.customer_label,
    rating: order.rating,
    ratingComment: order.rating_comment,
    createdAt: order.created_at,
    calledAt: order.called_at,
    completedAt: order.completed_at,
    cancelledAt: order.cancelled_at,
    merchant: merchant ? merchantSummary(merchant) : null,
  };
}

/** Shape shown to staff (includes ids + customer token). */
export function staffOrder(order: OrderRow) {
  return { id: order.id, token: order.token, ...publicOrder(order) };
}
