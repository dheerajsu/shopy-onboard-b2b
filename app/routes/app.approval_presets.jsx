// app.approval_presets.jsx

import prisma from "../db.server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import {
  useLoaderData,
  useNavigate,
  useSearchParams,
  useFetcher,
} from "react-router";
import { useState, useMemo, useEffect } from "react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { ensureDefaultPreset } from "./defaultPreset.server.js"

// ---------- LOADER ----------
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  await ensureDefaultPreset(shop);

  const url = new URL(request.url);
  const sortKey = url.searchParams.get("sort") || "createdAt";
  const sortOrder = url.searchParams.get("order") || "desc";

  const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
  const take = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("take") || "8")),
  );
  const skip = (page - 1) * take;

  let where = { shopId: shop };

  const totalCount = await prisma.preset.count({ where });
  const prestes = await prisma.preset.findMany({
    where,
    skip,
    take,
    orderBy: { [sortKey]: sortOrder === "asc" ? "asc" : "desc" },
  });

  const serialized = prestes.map((c) => ({
    ...c,
    createdAt: c.createdAt?.toISOString?.() ?? null,
    updatedAt: c.updatedAt?.toISOString?.() ?? null,
  }));

  const totalPages = Math.max(1, Math.ceil(totalCount / take));
  const pagination = {
    page,
    take,
    totalCount,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
    sortKey,
    sortOrder,
  };

  return Response.json({
    apiKey: process.env.SHOPIFY_API_KEY || "",
    presets: serialized,
    pagination,
  });
};

// ---------- ACTION: delete selected presets ----------
export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete-presets") {
    try {
      const idsRaw = formData.get("ids") || "[]";
      const ids = JSON.parse(idsRaw);

      if (Array.isArray(ids) && ids.length > 0) {
        await prisma.preset.deleteMany({
          where: {
            shopId: shop,
            id: { in: ids.map((id) => Number(id)) },
            isDefault: false,
          },
        });
      }

      return Response.json({ success: true });
    } catch (error) {
      console.error("Failed to delete presets:", error);
      return Response.json(
        { success: false, error: "Failed to delete presets" },
        { status: 500 },
      );
    }
  }

  return Response.json({ success: false, error: "Unknown intent" }, { status: 400 });
};

// ---------- PAGE ----------
export default function ApprovalPresetsPage() {
  const {
    apiKey,
    presets: initialPresets,
    pagination: initialPagination,
  } = useLoaderData();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fetcher = useFetcher();

  const [sortKey, setSortKey] = useState(initialPagination?.sortKey || "createdAt");
  const [sortOrder, setSortOrder] = useState(initialPagination?.sortOrder || "desc");
  const [take, setTake] = useState(initialPagination?.take || 10);
  const [selectedIds, setSelectedIds] = useState([]);

  const displayedPresets = useMemo(() => {
    return initialPresets || [];
  }, [initialPresets]);

  const { page, totalPages, totalCount, hasPreviousPage, hasNextPage } =
    initialPagination || {
      page: 1,
      totalPages: 1,
      totalCount: 0,
      hasPreviousPage: false,
      hasNextPage: false,
    };

  // Rebuild URL when pagination changes (kept minimal here)
  const goToPage = (newPage) => {
    const pageNum = Number(newPage);
    if (!Number.isFinite(pageNum) || pageNum < 1) return;
    const totalPages = initialPagination?.totalPages ?? 1;
    if (pageNum > totalPages) return;

    const params = new URLSearchParams();
    params.set("page", String(pageNum));
    if (sortKey && sortKey !== "createdAt") params.set("sort", sortKey);
    if (sortOrder && sortOrder !== "desc") params.set("order", sortOrder);
    if (take && Number(take) !== 10) params.set("take", String(take));

    navigate(`?${params.toString()}`, { replace: true });
  };

  const handlePreviousPage = (event) => {
    event?.preventDefault();
    goToPage((initialPagination?.page || 1) - 1);
  };

  const handleNextPage = (event) => {
    event?.preventDefault();
    goToPage((initialPagination?.page || 1) + 1);
  };

  const onRowClick = (id) => navigate(`/app/preset_edit/${id}`);

  const backpage = () => {
    navigate(`/app/companies`);
  };

  const newapprovalform = () => {
    navigate(`/app/presets/new`);
  };

  // ---------- selection helpers ----------
  const toggleOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };
const selectableIds = displayedPresets
  .filter((p) => !p.isDefault)
  .map((p) => p.id);

const allSelected =
  selectableIds.length > 0 &&
  selectedIds.length === selectableIds.length;

  const hasSelection = selectedIds.length > 0;

const toggleAll = () => {
  if (allSelected) {
    setSelectedIds([]);
  } else {
    setSelectedIds(selectableIds);
  }
};
  


  const handleDeleteSelected = () => {
    if (!hasSelection) return;
    // optional confirm
    if (!window.confirm(`Delete ${selectedIds.length} preset(s)?`)) return;

    fetcher.submit(
      {
        intent: "delete-presets",
        ids: JSON.stringify(selectedIds),
      },
      { method: "post" },
    );
  };

  // Clear selection after successful delete
  useEffect(() => {
    if (fetcher.data?.success) {
      setSelectedIds([]);
    }
  }, [fetcher.data]);

  return (
    <s-page inlineSize="large">
      <s-stack direction="block" gap="base">
        {/* header row */}
        <s-grid gridTemplateColumns="1fr auto">
          <s-stack direction="inline" gap="base large-100">
            <s-button icon="arrowLeft" variant="primary" onClick={backpage}>
              <s-icon type="arrow-left" />
            </s-button>
            <s-heading>Approval presets</s-heading>
          </s-stack>

          <s-button onClick={newapprovalform} variant="primary">
            Create approval presets
          </s-button>
        </s-grid>

        {/* NEW: selection summary + delete button */}
        {hasSelection && (
          <s-grid gridTemplateColumns="1fr auto" background="subdued" gap="base" paddingInline="base"  borderRadius="base base base large-100">
            <s-text>{selectedIds.length} selected</s-text>
            <s-button
              variant="secondary"
              tone="critical"
              onClick={handleDeleteSelected}
              loading={fetcher.state === "submitting"}
            >
              Delete
            </s-button>
          </s-grid>
        )}

        <s-stack direction="block" gap="base">
          <s-section padding="none">
            <s-table
              paginate
              hasPreviousPage={hasPreviousPage}
              hasNextPage={hasNextPage}
              onPreviousPage={handlePreviousPage}
              onNextPage={handleNextPage}
              variant="table"
            >
              <s-table-header-row>
                {/* NEW: header checkbox column */}
                <s-table-header>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                  />
                </s-table-header>

                <s-table-header>Preset title</s-table-header>
                <s-table-header>Catalogs</s-table-header>
                <s-table-header>Payment terms</s-table-header>
                <s-table-header>Deposit</s-table-header>
                <s-table-header>Ship to address</s-table-header>
                <s-table-header>Order submission</s-table-header>
                <s-table-header>Taxes</s-table-header>
              </s-table-header-row>

              <s-table-body>
                {displayedPresets.map((c) => {
                  const isSelected = selectedIds.includes(c.id);
                  const isDefault = c.isDefault;

                  return (
                    <s-table-row
                      key={c.id ?? c.presetTitle}
                      role="button"
                      tabIndex={0}
                      onClick={() => onRowClick(c.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") onRowClick(c.id);
                      }}
                      clickDelegate
                    >
                      {/* NEW: row checkbox cell */}
                      <s-table-cell>
                        <input
                          type="checkbox"
                          disabled={isDefault}
                          checked={isSelected}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleOne(c.id);
                          }}
                        />
                      </s-table-cell>

                      <s-table-cell>
                        <s-stack direction="inline" gap="small-100">
                            {c.isDefault && (
                                <s-icon type="pin" />
                            )}
                          <s-text weight="bold">
                            {c.presetTitle ?? "-"}
                          </s-text>
                        </s-stack>
                      </s-table-cell>

                      <s-table-cell>
                        <s-text>None selected</s-text>
                      </s-table-cell>

                      <s-table-cell>
                        <s-text weight="bold">
                          {c.paymentTerms?.name ?? ""}
                        </s-text>
                      </s-table-cell>

                      <s-table-cell>
                        {c.requireDeposit && (
                          <s-badge tone="subdued">
                            {c.requireDeposit ? `${c.requireDeposit}%` : ""}
                          </s-badge>
                        )}
                      </s-table-cell>

                      <s-table-cell>
                        <s-icon type="shipping-label" />
                      </s-table-cell>

                      <s-table-cell>
                        <s-text weight="bold">{c.contactRole ?? ""}</s-text>
                      </s-table-cell>

                      <s-table-cell>
                        <s-text>
                          {c.taxes === "true"
                            ? "Collect tax"
                            : "Don't collect tax"}
                        </s-text>
                      </s-table-cell>
                    </s-table-row>
                  );
                })}
              </s-table-body>

              {/* Pagination controls */}
              <div slot="pagination">
                <s-stack direction="inline" gap="small-200" align="center">
                  <button
                    type="button"
                    onClick={handlePreviousPage}
                    disabled={!hasPreviousPage}
                  >
                    Previous
                  </button>

                  <s-text>
                    Page {page} of {totalPages} — {totalCount} result(s)
                  </s-text>

                  <button
                    type="button"
                    onClick={handleNextPage}
                    disabled={!hasNextPage}
                  >
                    Next
                  </button>
                </s-stack>
              </div>
            </s-table>
          </s-section>
        </s-stack>
      </s-stack>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
