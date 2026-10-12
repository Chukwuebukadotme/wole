// Lagos (Wole Wole) opens from West Road Life, old challenge links forward to it, and it links back to London.
export default async ({ go, ev, shot, click, phone, sleep }) => {
  await phone();
  await go('./?debug', 9000);
  await shot('lagos-1-wrl-home');
  await click('[data-action=lagos]');
  await sleep(7000);
  console.log('after Lagos button:', await ev('location.pathname'), await ev(`document.title`));
  await shot('lagos-2-wole-home');
  console.log('back link:', await ev(`document.querySelector('.city-link')?.getAttribute('href')`));
  // An old Wole Wole daily-shift challenge link sent to the site root.
  await go('./?c=eyJkIjoiMjAyNi0xMC0xMiIsInMiOjE4NTAsIm4iOiJUdW5kZSJ9', 8000);
  console.log('old link lands on:', await ev('location.pathname + location.search'));
  await shot('lagos-3-old-link');
  await click('.city-link');
  await sleep(8000);
  console.log('back to:', await ev('location.pathname'), await ev(`document.title`));
};
