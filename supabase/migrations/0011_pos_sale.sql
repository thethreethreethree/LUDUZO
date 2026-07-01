-- ============================================================================
-- LUDUZO — Phase 3 (POS): record_sale() — atomic point-of-sale.
-- Builds on 0005 (invoices) + 0008 (products).
--
-- WHY a function: front_desk sells, but products write is management-gated (0008).
-- record_sale() is SECURITY DEFINER and authorizes the caller as STAFF of the
-- product's org, then atomically: decrements stock, creates a PAID invoice, and
-- emits a 'sale.recorded' event (§3.1). This avoids widening products RLS.
--
-- Governed by: CLAUDE.md §1.5.1 layer 1+3 · §3.1 · A12. UNTESTED until run.
-- ============================================================================

create or replace function record_sale(p_product_id uuid, p_quantity integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_prod products%rowtype;
  v_amount integer;
  v_invoice uuid;
begin
  if v_uid is null then raise exception 'record_sale: not authenticated'; end if;
  if p_quantity is null or p_quantity < 1 then raise exception 'record_sale: quantity must be >= 1'; end if;

  select * into v_prod from products where id = p_product_id;
  if not found then raise exception 'record_sale: product not found'; end if;

  if not auth_has_org_role(v_prod.organization_id,
       array['owner','admin','manager','front_desk']::app_role[]) then
    raise exception 'record_sale: not authorized for this gym' using errcode = 'insufficient_privilege';
  end if;

  v_amount := v_prod.price_cents * p_quantity;

  update products set stock_quantity = stock_quantity - p_quantity where id = p_product_id;

  insert into invoices (organization_id, amount_cents, currency, status, paid_at, metadata)
  values (v_prod.organization_id, v_amount, v_prod.currency, 'paid', now(),
          jsonb_build_object('product_id', p_product_id, 'quantity', p_quantity, 'kind', 'pos_sale'))
  returning id into v_invoice;

  insert into events (organization_id, actor_id, event_type, subject_type, subject_id, payload)
  values (v_prod.organization_id, v_uid, 'sale.recorded', 'product', p_product_id,
          jsonb_build_object('quantity', p_quantity, 'amount_cents', v_amount, 'invoice_id', v_invoice));

  return v_invoice;
end$$;

grant execute on function record_sale(uuid, integer) to authenticated;

-- End of 0011_pos_sale.sql
