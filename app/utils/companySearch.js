export function filterAndSortCompanies(companies = [], options = {}) {
  const { searchTerm = "", sortKey = "created", sortOrder = "desc" } = options;

  // defensive copy
  let result = Array.isArray(companies) ? [...companies] : [];

  // normalize filter
  const term = (searchTerm || "").toLowerCase().trim();

  if (term) {
    result = result.filter((c) => {
      const name = (c.name || "").toLowerCase();
      const externalId = (c.externalId || "").toLowerCase();

      // support different shapes for contact/email/phone
      const contact = c.companycontact || {};
      const customerName = (contact.customername || contact.customerName || "").toLowerCase();
      const email = (contact.email || contact.contactEmail || "").toLowerCase();
      const phone = (contact.phone || contact.phoneNumber || "").toLowerCase();

      return (
        name.includes(term) ||
        externalId.includes(term) ||
        customerName.includes(term) ||
        email.includes(term) ||
        phone.includes(term)
      );
    });
  }

  // sorting
  result.sort((a, b) => {
    let av, bv;

    if (sortKey === "company-name") {
      av = (a.name || "").toLowerCase();
      bv = (b.name || "").toLowerCase();
    } else if (sortKey === "status") {
      // normalize status to numbers so sorting is consistent
      const as = a.companycontact?.companystatus;
      const bs = b.companycontact?.companystatus;
      av = as === true ? 2 : as === false ? 1 : 0;
      bv = bs === true ? 2 : bs === false ? 1 : 0;
    } else {
      // created
      av = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      bv = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    }

    if (av < bv) return sortOrder === "asc" ? -1 : 1;
    if (av > bv) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  return result;
}
