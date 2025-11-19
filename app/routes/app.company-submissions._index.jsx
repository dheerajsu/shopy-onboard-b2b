import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);
  const shop = admin.session.shop;

  const submissions = await prisma.companySubmission.findMany({
    where: { shopDomain: shop },
    orderBy: { createdAt: 'desc' }
  });

  return json({ submissions, shop });
}

export default function CompanySubmissions() {
  const { submissions, shop } = useLoaderData();

  // Format data for Polaris DataTable
  const rows = submissions.map((submission) => [
    submission.submissionId,
    submission.companyName,
    submission.contactName,
    submission.email,
    submission.phone || 'N/A',
    submission.country,
    submission.industry || 'N/A',
    submission.companySize || 'N/A',
    new Date(submission.createdAt).toLocaleDateString(),
    <Text as="span" variant="bodyMd" tone={getStatusTone(submission.status)}>
      {submission.status}
    </Text>
  ]);

  return (
    <Page
      title="Company Submissions"
      subtitle={`Shop: ${shop}`}
      primaryAction={{
        content: "Refresh",
        onAction: () => window.location.reload(),
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <DataTable
              columnContentTypes={[
                'text',
                'text',
                'text',
                'text',
                'text',
                'text',
                'text',
                'text',
                'text',
                'text',
              ]}
              headings={[
                'Submission ID',
                'Company Name',
                'Contact Name',
                'Email',
                'Phone',
                'Country',
                'Industry',
                'Company Size',
                'Submitted',
                'Status'
              ]}
              rows={rows}
              footerContent={`Total submissions: ${submissions.length}`}
            />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function getStatusTone(status) {
  switch (status) {
    case 'pending': return 'warning';
    case 'approved': return 'success';
    case 'rejected': return 'critical';
    default: return 'subdued';
  }
}