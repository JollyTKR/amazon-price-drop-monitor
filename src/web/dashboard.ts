import type { PriceCheckRecord, PriceHistoryRepository } from "../storage/PriceHistoryRepository.js";
import type { AppConfig, ProductConfig } from "../types/domain.js";

export interface ProductDashboardRow {
  product: ProductConfig;
  latestCheck: PriceCheckRecord | null;
  latestSuccessfulCheck: PriceCheckRecord | null;
}

export function getProductDashboardRows(
  config: AppConfig,
  repository: PriceHistoryRepository,
): ProductDashboardRow[] {
  return config.products.map((product) => ({
    product,
    latestCheck: repository.getLatestPriceCheck(product.id),
    latestSuccessfulCheck: repository.getLatestSuccessfulPriceCheck(product.id),
  }));
}

export function renderDashboardPage(rows: ProductDashboardRow[]): string {
  const tableRows = rows
    .map(({ product, latestCheck, latestSuccessfulCheck }) => {
      const status = latestCheck?.status ?? "not checked";
      const statusClass = getStatusClass(status);
      const lastChecked = latestCheck?.checkedAt ?? "never";
      const latestPrice = latestSuccessfulCheck?.priceCents;
      const historyPath = `/products/${encodeURIComponent(product.id)}/history`;

      return `
        <tr>
          <td>${escapeHtml(product.name)}</td>
          <td><code>${escapeHtml(product.id)}</code></td>
          <td>${formatPrice(latestPrice)}</td>
          <td><span class="status ${statusClass}">${escapeHtml(status)}</span></td>
          <td>${escapeHtml(lastChecked)}</td>
          <td><a class="action-link" href="${historyPath}">View history</a></td>
          <td><a href="${escapeHtml(product.url)}" rel="noreferrer">Configured URL</a></td>
        </tr>
      `;
    })
    .join("");

  return renderPage(
    "Price Drop Monitor",
    `
      <header>
        <h1>Price Drop Monitor</h1>
        <p>Configured fixture-backed products and their latest recorded checks.</p>
      </header>
      <main>
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>ID</th>
              <th>Latest known price</th>
              <th>Latest check status</th>
              <th>Last checked</th>
              <th>History</th>
              <th>URL</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </main>
    `,
  );
}

export function renderProductHistoryPage(
  product: ProductConfig,
  history: PriceCheckRecord[],
): string {
  const rows =
    history.length === 0
      ? `
        <tr>
          <td colspan="6">No price checks recorded yet.</td>
        </tr>
      `
      : history
          .map(
            (check) => `
              <tr>
                <td>${escapeHtml(check.checkedAt)}</td>
                <td>${formatPrice(check.priceCents)}</td>
                <td>${escapeHtml(check.currency ?? "")}</td>
                <td><span class="status ${getStatusClass(check.status)}">${escapeHtml(check.status)}</span></td>
                <td>${escapeHtml(check.source)}</td>
                <td>${escapeHtml(check.errorMessage ?? "")}</td>
              </tr>
            `,
          )
          .join("");

  return renderPage(
    `${product.name} History`,
    `
      <header>
        <p><a href="/">Back to dashboard</a></p>
        <h1>${escapeHtml(product.name)}</h1>
        <p><code>${escapeHtml(product.id)}</code> · <a href="${escapeHtml(product.url)}" rel="noreferrer">Configured URL</a></p>
      </header>
      <main>
        <section>
          <h2>Price History</h2>
          <table>
            <thead>
              <tr>
                <th>Checked at</th>
                <th>Price</th>
                <th>Currency</th>
                <th>Status</th>
                <th>Source</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </section>
        <section>
          <h2>API</h2>
          <p><a href="/api/products/${encodeURIComponent(product.id)}/history">JSON history for this product</a></p>
        </section>
      </main>
    `,
  );
}

function renderPage(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Arial, sans-serif;
        line-height: 1.4;
      }
      body {
        margin: 0;
        color: #1f2933;
        background: #f6f8fa;
      }
      header,
      main {
        max-width: 1100px;
        margin: 0 auto;
        padding: 24px;
      }
      header {
        padding-bottom: 8px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 28px;
      }
      h2 {
        margin-top: 24px;
        font-size: 20px;
      }
      p {
        margin: 0 0 12px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        background: #ffffff;
        border: 1px solid #d9e2ec;
      }
      th,
      td {
        padding: 10px 12px;
        border-bottom: 1px solid #d9e2ec;
        text-align: left;
        vertical-align: top;
      }
      th {
        background: #eef2f7;
        font-weight: 700;
      }
      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
      a {
        color: #0b5cad;
      }
      .action-link {
        font-weight: 700;
        white-space: nowrap;
      }
      .status {
        display: inline-block;
        min-width: 72px;
        padding: 2px 8px;
        border-radius: 999px;
        background: #e6eef8;
      }
      .status-success {
        background: #d8f3dc;
      }
      .status-failure {
        background: #fde2e1;
      }
    </style>
  </head>
  <body>
    ${body}
  </body>
</html>`;
}

function formatPrice(priceCents: number | null | undefined): string {
  if (priceCents == null) {
    return "n/a";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(priceCents / 100);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getStatusClass(status: string): string {
  return `status-${status.replaceAll(" ", "-")}`;
}
