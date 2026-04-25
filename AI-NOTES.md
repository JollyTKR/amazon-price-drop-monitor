# AI-NOTES

Before implementation, AI assistance initially treated the assignment as a normal web scraping problem and suggested approaches that could involve live Amazon HTML scraping. I checked the legal/ethical requirement in the brief and reviewed Amazon's terms myself, then changed the design to avoid live Amazon scraping by default.

Another issue appeared during planning: an AI-generated pseudocode section used a sequential `for...of` loop for product checks, even though the brief required monitoring multiple products concurrently. I caught that before implementation and made the monitor use bounded concurrency with `p-limit` and `Promise.allSettled`, so one product failure does not stop the others.
