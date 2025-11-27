import prisma from "../db.server"
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { useLoaderData, useNavigate, useSearchParams } from "react-router";
import { useState, useMemo, useEffect } from "react";
import { authenticate } from "../shopify.server";
import {boundary} from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const url = new URL(request.url);
  const searchTerm = url.searchParams.get("search") || "";
  const sortKey = url.searchParams.get("sort") || "createdAt";
  const sortOrder = url.searchParams.get("order") || "desc";
  const statusFilter = url.searchParams.get("status") || "all";

  const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
  const take = Math.min(100, Math.max(1, Number(url.searchParams.get("take") || "8")));
  const skip = (page - 1) * take;

  // Build base where clause
  let where = { shopId: shop };

  // Add search conditions
  const searchConditions = [];
  if (searchTerm) {
    searchConditions.push(
      { name: { contains: searchTerm } },
      { externalId: { contains: searchTerm } }
    );
  }

  // Add status conditions
  let statusConditions = {};
  if (statusFilter !== "all") {
    if (statusFilter === "open") {
      statusConditions = { companyStatus: 'open' };
    } else if (statusFilter === "closed") {
      statusConditions = {
        OR: [
          { companyStatus: 'approved' },
          { companyStatus: 'autoApproved' }
        ]
      };
    }
  }

  // Combine conditions
  if (searchConditions.length > 0 && Object.keys(statusConditions).length > 0) {
    where.AND = [
      { OR: searchConditions },
      statusConditions
    ];
  } else if (searchConditions.length > 0) {
    where.OR = searchConditions;
  } else if (Object.keys(statusConditions).length > 0) {
    Object.assign(where, statusConditions);
  }

  const totalCount = await prisma.company.count({ where });
  const companies = await prisma.company.findMany({
    where,
    skip,
    take,
    orderBy: { [sortKey]: sortOrder === "asc" ? "asc" : "desc" },
    include: { companycontact: true },
  });

  const serialized = companies.map((c) => ({
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
    searchTerm,
    sortKey,
    sortOrder,
    statusFilter,
  };

  return Response.json({
    apiKey: process.env.SHOPIFY_API_KEY || "",
    companies: serialized,
    pagination,
  });
};

export default function CompaniesPage() {
  const { apiKey, companies: initialCompanies, pagination: initialPagination } = useLoaderData();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchTerm, setSearchTerm] = useState(initialPagination?.searchTerm || "");
  const [sortKey, setSortKey] = useState(initialPagination?.sortKey || "createdAt");
  const [sortOrder, setSortOrder] = useState(initialPagination?.sortOrder || "desc");
  const [statusFilter, setStatusFilter] = useState(initialPagination?.statusFilter || "all");
  const [take, setTake] = useState(initialPagination?.take || 10);

  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // When debouncedSearch / sort / order / status / take changes -> update URL params
  useEffect(() => {
    const params = new URLSearchParams();

    if (debouncedSearch) params.set("search", debouncedSearch);
    if (sortKey && sortKey !== "createdAt") params.set("sort", sortKey);
    if (sortOrder && sortOrder !== "desc") params.set("order", sortOrder);
    if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
    if (take && Number(take) !== 10) params.set("take", String(take));
    
    // reset to first page whenever filters change
    params.set("page", "1");

    navigate(`?${params.toString()}`, { replace: true });
  }, [debouncedSearch, sortKey, sortOrder, statusFilter, take, navigate]);

  // Pagination function
  const goToPage = (newPage) => {
    const pageNum = Number(newPage);
    if (!Number.isFinite(pageNum) || pageNum < 1) return;

    const totalPages = initialPagination?.totalPages ?? 1;
    if (pageNum > totalPages) return;

    // Use navigate to update URL and trigger loader
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (sortKey && sortKey !== "createdAt") params.set("sort", sortKey);
    if (sortOrder && sortOrder !== "desc") params.set("order", sortOrder);
    if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
    if (take && Number(take) !== 10) params.set("take", String(take));
    params.set("page", String(pageNum));
    
    navigate(`?${params.toString()}`, { replace: true });
  };

  // Create wrapped handlers for the buttons
  const handlePreviousPage = (event) => {
    event?.preventDefault();
    goToPage((initialPagination?.page || 1) - 1);
  };

  const handleNextPage = (event) => {
    event?.preventDefault();
    goToPage((initialPagination?.page || 1) + 1);
  };

  // Status filter handlers
  const handleStatusFilter = (newStatus) => {
    setStatusFilter(newStatus);
  };

  const formatDate = (iso) => (iso ? new Date(iso).toLocaleString() : "-");
  const onRowClick = (id) => navigate(`/company/${id}`);

  const displayedCompanies = useMemo(() => {
    return initialCompanies || [];
  }, [initialCompanies]);
  //console.log("company displayed ----------------",displayedCompanies);

  const { page, totalPages, totalCount, hasPreviousPage, hasNextPage } = initialPagination || {
    page: 1,
    totalPages: 1,
    totalCount: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  };

  return (
    <s-page>
      <s-stack direction="block" gap="base">
        <s-grid gridTemplateColumns="1fr auto">
          <s-heading>Company Applications</s-heading>
          {/* <s-badge>Manage approval presets</s-badge> */}
        </s-grid>

        <s-box heading="Applications" padding="base" border="base" borderRadius="base" background="base">
          <s-stack direction="block" gap="base">
            {/* ✅ Dynamic Status Filter buttons */}
            <s-stack direction="inline" gap="base">
              <s-badge 
                tone={statusFilter === "open" ? "success" : "subdued"}
                role="button"
                onClick={() => handleStatusFilter("open")}
                
              >
                Open
              </s-badge>
              <s-badge 
                tone={statusFilter === "closed" ? "success" : "subdued"}
                role="button"
                onClick={() => handleStatusFilter("closed")}
                
              >
                Closed
              </s-badge>
              <s-badge 
                tone={statusFilter === "all" ? "success" : "subdued"}
                role="button"
                onClick={() => handleStatusFilter("all")}
                
              >
                All
              </s-badge>
            </s-stack>

            <s-section padding="none">
              <s-table 
                paginate 
                hasPreviousPage={hasPreviousPage} 
                hasNextPage={hasNextPage}
                onPreviousPage={handlePreviousPage}
                onNextPage={handleNextPage}
                variant="table"
              >
                <s-grid slot="filters" gap="small-200" gridTemplateColumns="1fr auto">
                  <s-search-field
                    placeholder="Search companies"
                    value={searchTerm}
                    onInput={(e) => setSearchTerm(e.target.value)}
                  />

                  <s-popover id="sort-actions" active>
                    <s-choice-list
                      label="Sort by"
                      name="sortBy"
                      value={sortKey}
                      onChange={(e) => setSortKey(e.target.value)}
                    >
                      <s-choice value="name">Company name</s-choice>
                      <s-choice value="createdAt">Created</s-choice>
                      <s-choice value="status">Status</s-choice>
                    </s-choice-list>
                  </s-popover>
                </s-grid>

                <s-table-header-row>
                  <s-table-header>Company name</s-table-header>
                  <s-table-header>Primary contact</s-table-header>
                  <s-table-header>Status</s-table-header>
                  <s-table-header>verifiedEmail</s-table-header>
                  <s-table-header>Application Last Submitted</s-table-header>
                </s-table-header-row>
                
                <s-table-body>
                  {displayedCompanies.map((c) => (
                    <s-table-row
                      key={c.id ?? c.externalId ?? c.name}
                      role="button"
                      tabIndex={0}
                      onClick={() => onRowClick(c.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") onRowClick(c.id);
                      }}
                      clickDelegate
                    >
                      <s-table-cell>
                        <s-stack direction="block" gap="small-100">
                          <s-text weight="bold">{c.name ?? "-"}</s-text>
                          {/* <s-text tone="subtle" size="small">
                            {c.externalId ?? "-"}
                          </s-text> */}
                        </s-stack>
                      </s-table-cell>

                      <s-table-cell>
                        <s-text>
                          {c.companycontact?.customername ?? c.customerEmail ?? "-"}
                        </s-text>
                      </s-table-cell>

                      <s-table-cell>
                        <s-badge
                          // tone={
                          //   c.companycontact?.companystatus === true ? "success" : c.companycontact?.companystatus === false ? "warning" : "subdued"
                          // }
                          tone={
                            c.companyStatus === 'approved' ? "success" 
                            : c.companyStatus === 'open' ? "warning" 
                            : c.companyStatus === 'autoApprove' ? "info" 
                            : "subdued"
                          }
                        >
                          {/* {c.companycontact?.companystatus === true ? "Approved" : c.companycontact?.companystatus === false ? "Pending" : "Unknown"} */}
                          {c.companyStatus === 'approved' ? "Approved" : 
                          c.companyStatus === 'open' ? "Pending" : 
                          c.companyStatus === 'autoApprove' ? "Auto Approved" 
                          : "Pending"}
                        </s-badge>
                      </s-table-cell>
                      
                      <s-table-cell>
                        <s-badge
                          tone={
                            c.aurthorizedStatus === true ? "success" 
                            : c.aurthorizedStatus === false ? "warning" 
                            : "subdued"
                          }
                        >
                          {/* {c.companycontact?.companystatus === true ? "Approved" : c.companycontact?.companystatus === false ? "Pending" : "Unknown"} */}
                          {c.aurthorizedStatus === true ? "verified" : 
                          c.aurthorizedStatus === false ? "Pending"
                          : "Pending"}
                        </s-badge>
                      </s-table-cell>

                      <s-table-cell>{formatDate(c.createdAt)}</s-table-cell>
                    </s-table-row>
                  ))}
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
        </s-box>
      </s-stack>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
