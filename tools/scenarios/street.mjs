// Street-level views of London from the dev street view (?street). VIEWS="name|query|phone,..."
export default async ({ go, shot, size, phone }) => {
  for (const v of (process.env.VIEWS ?? '').split(',').filter(Boolean)) {
    const [name, query, dev] = v.split('|');
    if (dev === 'phone') await phone();
    else await size(1280, 720);
    await go(`./?street&${query}`, 7000);
    await shot(name);
  }
};
