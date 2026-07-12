
-- ============================================================
-- 恆春民宿 CMS：Supabase 一次性安裝 SQL
-- 請整份貼到 Supabase → SQL Editor → Run
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.stays (
  id uuid primary key default gen_random_uuid(),
  no_label text not null,
  sort_order integer not null default 0,
  name text not null,
  slug text not null unique,
  label text default '',
  capacity text default '',
  room_types text default '',
  address text default '',
  checkin text default '',
  checkout text default '',
  security_deposit text default '',
  booking_deposit text default '',
  extra_bed text default '',
  facilities text default '',
  high_season_price text default '',
  low_season_price text default '',
  note text default '',
  cover_image_url text default '',
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stay_images (
  id uuid primary key default gen_random_uuid(),
  stay_id uuid not null references public.stays(id) on delete cascade,
  category text not null check (category in ('day','night','room')),
  image_url text not null,
  storage_path text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and is_admin=true); $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$
declare first_user boolean;
begin
  select not exists(select 1 from public.profiles) into first_user;
  insert into public.profiles(id,email,is_admin)
  values(new.id,new.email,first_user)
  on conflict(id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists stays_updated_at on public.stays;
create trigger stays_updated_at before update on public.stays for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.stays enable row level security;
alter table public.stay_images enable row level security;
alter table public.site_settings enable row level security;

drop policy if exists "public read published stays" on public.stays;
create policy "public read published stays" on public.stays for select using (is_published=true or public.is_admin());
drop policy if exists "admin manage stays" on public.stays;
create policy "admin manage stays" on public.stays for all using(public.is_admin()) with check(public.is_admin());

drop policy if exists "public read images" on public.stay_images;
create policy "public read images" on public.stay_images for select using (
  exists(select 1 from public.stays s where s.id=stay_id and (s.is_published=true or public.is_admin()))
);
drop policy if exists "admin manage images" on public.stay_images;
create policy "admin manage images" on public.stay_images for all using(public.is_admin()) with check(public.is_admin());

drop policy if exists "public read settings" on public.site_settings;
create policy "public read settings" on public.site_settings for select using(true);
drop policy if exists "admin manage settings" on public.site_settings;
create policy "admin manage settings" on public.site_settings for all using(public.is_admin()) with check(public.is_admin());

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select using(id=auth.uid());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('homestay-images','homestay-images',true,10485760,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=true;

drop policy if exists "public storage read" on storage.objects;
create policy "public storage read" on storage.objects for select using(bucket_id='homestay-images');
drop policy if exists "admin storage insert" on storage.objects;
create policy "admin storage insert" on storage.objects for insert to authenticated
with check(bucket_id='homestay-images' and public.is_admin());
drop policy if exists "admin storage update" on storage.objects;
create policy "admin storage update" on storage.objects for update to authenticated
using(bucket_id='homestay-images' and public.is_admin());
drop policy if exists "admin storage delete" on storage.objects;
create policy "admin storage delete" on storage.objects for delete to authenticated
using(bucket_id='homestay-images' and public.is_admin());

-- 網站設定初始資料
insert into public.site_settings(key,value) values
('intro_title','恆春民宿簡介'),
('intro_p1','我們精選恆春在地特色住宿，從峇里島 Villa、庭園包棟、親子民宿到庭園木屋，每一間都有不同的風格與特色，滿足情侶、家庭、好友聚會及團體旅遊等不同住宿需求。'),
('intro_p2','無論您想享受私人泳池、親子戲水、烤肉聚會，或是沉浸於自然景觀與悠閒氛圍，都能在這裡找到最適合您的度假空間，刻下專屬於您與親朋好友的美好回憶。'),
('hero_image_url','assets/hengchun-main-banner.png'),
('price_note_1','※ 以上報價不適用於春節、音樂祭、特殊節日。農曆春節、特殊假日及連假期間：價格另計。'),
('price_note_2','※ 週日入住等同平日價格。'),
('contact_title','開始安排您的恆春假期'),
('contact_text','訂房與房況請透過 LINE 或 Instagram 聯繫。'),
('line_id','tina2001128'),
('instagram_handle','xav.yi_'),
('instagram_url','https://www.instagram.com/xav.yi_/'),
('notice_1_title','訂房訂金'),('notice_1_body','訂房需支付 50% 訂金，完成匯款後才算保留房間。'),
('notice_2_title','入住付款'),('notice_2_body','餘款於入住當天辦理入住時支付。'),
('notice_3_title','攜帶寵物'),('notice_3_body','如需攜帶寵物，請於訂房前先與我們確認。'),
('notice_4_title','入住前資訊'),('notice_4_body','入住前一天，民宿管家將提供具體位置與導航、停車資訊、入住方式及當日聯絡電話。'),
('notice_5_title','退房時間'),('notice_5_body','退房時，如有需要加時間，請提前告知。'),
('notice_6_title','聯絡服務'),('notice_6_body','若有任何問題，歡迎隨時與我們聯繫，我們將竭誠為您服務。')
on conflict(key) do nothing;

-- 既有五間民宿初始資料
insert into public.stays(no_label,sort_order,name,slug,label,capacity,room_types,address,checkin,checkout,security_deposit,booking_deposit,extra_bed,facilities,high_season_price,low_season_price,note,cover_image_url,is_published) values
('一館',1,'麗景小木屋','lijing','可包棟・可單房','50 人','雙人房、四人房、六人房','屏東縣恆春鎮德和里坪頂路230號','下午3點 ( After 3 PM )','上午11:00 ( Before 11 AM )  ※ 如需要加時間請提前告知 ※ ','$10000（退房時確認無蓄意破壞、室內抽菸等行徑，會全額退還的唷~）','訂房價格的50%（完成匯款後才算保留房間）','☑ 平日$800/人、連續假日$1000/人','KTV歡唱(至11PM), WiFi網路, 含停車位, 寵物可詢問, 泳池, 烤肉區, 麻將','2 人 ⭢ 平日(含週日) $2000、假日 $2800
4 人 ⭢ 平日(含週日) $2800、假日 $3800
6 人 ⭢ 平日(含週日) $3800、假日 $4800
包棟 ⭢ 平日(含週日) $36000、假日 $46000','2 人 ⭢ 平日(含週日) $1500、假日 $2000
4 人 ⭢ 平日(含週日) $2000、假日 $2800
6 人 ⭢ 平日(含週日) $3000、假日 $3800
包棟 ⭢ 平日(含週日) $35000、假日 $42000','以上報價不適用於春節、音樂祭、特殊節日。
農曆春節、特殊假日及連假期間：價格另計。','assets/stays/lijing/cover.jpg',true),
('二館',2,'牧羊人 Villa民宿','shepherd','包棟民宿','22 人','雙人房 ×5、四人房 ×3','屏東縣恆春鎮德和里德和路415巷25號','下午3點 (After 3 PM)','上午11:00 (Before 11 AM)  ※ 如需要加時間請提前告知 ※ ','$10000（退房時確認無蓄意破壞、室內抽菸等行徑，會全額退還的唷~）','訂房價格的50%（完成匯款後才算保留房間）','☑ 平日$800/人、連續假日$1000/人','KTV歡唱(無限時), WiFi網路, 含停車位, 寵物可詢問, 泳池, 烤肉區, 麻將','平日(含週日) $19999、週五 $21999、週六 $25999','平日(含週日) $15999、週五 $17999、週六 $19999','以上報價不適用於春節、音樂祭、特殊節日。
農曆春節、特殊假日及連假期間：價格另計。','assets/stays/shepherd/cover.jpg',true),
('三館',3,'橘日民宿','orange','包棟民宿','16 人','雙人房 ×2、四人房 ×4','當天入住之房客，請先與民宿管家聯繫取得地址唷~','下午3點 (After 3 PM)','上午11:00 (Before 11 AM)  ※ 如需要加時間請提前告知 ※ ','$10000（退房時確認無蓄意破壞、室內抽菸等行徑，會全額退還的唷~）','訂房價格的50%（完成匯款後才算保留房間）','☑ 平日$800/人、連續假日$1000/人','KTV歡唱(至10:30PM), WiFi網路, 含停車位, 寵物可詢問, 泳池, 烤肉區, 麻將','平日(含週日) $15999、週五 $19999、週六 $23999','平日(含週日) $14999、週五 $15999、週六 $17999','以上報價不適用於春節、音樂祭、特殊節日。
農曆春節、特殊假日及連假期間：價格另計。','assets/stays/orange/cover.jpg',true),
('四館',4,'北門民宿☆新民宿☆','beimen','包棟民宿','26 人','雙人房 ×5、四人房 ×4','當天入住之房客，請先與民宿管家聯繫取得地址唷~','下午3點 (After 3 PM)','上午11:00 (Before 11 AM)  ※ 如需要加時間請提前告知 ※ ','$15000（退房時確認無蓄意破壞、室內抽菸等行徑，會全額退還的唷~）','訂房價格的50%（完成匯款後才算保留房間）','☑ 平日$800/人、連續假日$1000/人','KTV歡唱(無限時), WiFi網路, 含停車位, 寵物可詢問, 泳池, 烤肉區, 麻將','平日(含週日) $32000、週五 $36000、週六 $38000','平日(含週日) $26000、週五 $28000、週六 $32000','以上報價不適用於春節、音樂祭、特殊節日。
農曆春節、特殊假日及連假期間：價格另計。','assets/stays/beimen/cover.jpg',true),
('五館',5,'東門民宿','dongmen','包棟民宿','26 人','露營車(雙人) ×3、四人房 ×3、八人房 ×1','當天入住之房客，請先與民宿管家聯繫取得地址唷~','下午3點 (After 3 PM)','上午11:00 (Before 11 AM)  ※ 如需要加時間請提前告知 ※ ','$10000（退房時確認無蓄意破壞、室內抽菸等行徑，會全額退還的唷~）','訂房價格的50%（完成匯款後才算保留房間）','☑ 平日$800/人、連續假日$1000/人','KTV歡唱(無限時), WiFi網路, 含停車位, 寵物可詢問, 泳池, 烤肉區, 麻將','平日(含週日) $19999、週五 $23999、週六 $27999','平日(含週日) $17999、週五 $18999、週六 $21999','以上報價不適用於春節、音樂祭、特殊節日。
農曆春節、特殊假日及連假期間：價格另計。','assets/stays/dongmen/cover.jpg',true)
on conflict(slug) do nothing;

-- 匯入既有本機相簿路徑
insert into public.stay_images(stay_id,category,image_url,sort_order)
select s.id, x.category, x.url, x.ord
from public.stays s
join (values
('lijing','day','assets/stays/lijing/day-1.jpg',1),
('lijing','day','assets/stays/lijing/day-2.jpg',2),
('lijing','day','assets/stays/lijing/day-3.jpg',3),
('lijing','day','assets/stays/lijing/day-4.jpg',4),
('lijing','day','assets/stays/lijing/day-5.jpg',5),
('lijing','day','assets/stays/lijing/day-6.jpg',6),
('lijing','day','assets/stays/lijing/day-7.jpg',7),
('lijing','night','assets/stays/lijing/night-1.jpg',8),
('lijing','night','assets/stays/lijing/night-2.jpg',9),
('lijing','night','assets/stays/lijing/night-3.jpg',10),
('lijing','night','assets/stays/lijing/night-4.jpg',11),
('lijing','room','assets/stays/lijing/room-1.jpg',12),
('lijing','room','assets/stays/lijing/room-2.jpg',13),
('lijing','room','assets/stays/lijing/room-3.jpg',14),
('lijing','room','assets/stays/lijing/room-4.jpg',15),
('shepherd','day','assets/stays/shepherd/day-1.jpg',1),
('shepherd','day','assets/stays/shepherd/day-2.jpg',2),
('shepherd','day','assets/stays/shepherd/day-3.jpg',3),
('shepherd','day','assets/stays/shepherd/day-4.jpg',4),
('shepherd','day','assets/stays/shepherd/day-5.jpg',5),
('shepherd','day','assets/stays/shepherd/day-6.jpg',6),
('shepherd','day','assets/stays/shepherd/day-7.jpg',7),
('shepherd','day','assets/stays/shepherd/day-8.jpg',8),
('shepherd','night','assets/stays/shepherd/night-1.jpg',9),
('shepherd','night','assets/stays/shepherd/night-2.jpg',10),
('shepherd','room','assets/stays/shepherd/room-1.jpg',11),
('shepherd','room','assets/stays/shepherd/room-2.jpg',12),
('shepherd','room','assets/stays/shepherd/room-3.jpg',13),
('shepherd','room','assets/stays/shepherd/room-4.jpg',14),
('orange','day','assets/stays/orange/day-1.jpg',1),
('orange','day','assets/stays/orange/day-2.jpg',2),
('orange','day','assets/stays/orange/day-3.jpg',3),
('orange','day','assets/stays/orange/day-4.jpg',4),
('orange','day','assets/stays/orange/day-5.jpg',5),
('orange','day','assets/stays/orange/day-6.jpg',6),
('orange','day','assets/stays/orange/day-7.jpg',7),
('orange','day','assets/stays/orange/day-8.jpg',8),
('orange','day','assets/stays/orange/day-9.jpg',9),
('orange','night','assets/stays/orange/night-1.jpg',10),
('orange','night','assets/stays/orange/night-2.jpg',11),
('orange','night','assets/stays/orange/night-3.jpg',12),
('orange','room','assets/stays/orange/room-1.jpg',13),
('orange','room','assets/stays/orange/room-2.jpg',14),
('orange','room','assets/stays/orange/room-3.jpg',15),
('orange','room','assets/stays/orange/room-4.jpg',16),
('beimen','day','assets/stays/beimen/day-1.jpg',1),
('beimen','day','assets/stays/beimen/day-2.jpg',2),
('beimen','day','assets/stays/beimen/day-3.jpg',3),
('beimen','day','assets/stays/beimen/day-4.jpg',4),
('beimen','day','assets/stays/beimen/day-5.jpg',5),
('beimen','day','assets/stays/beimen/day-6.jpg',6),
('beimen','day','assets/stays/beimen/day-7.jpg',7),
('beimen','day','assets/stays/beimen/day-8.jpg',8),
('beimen','day','assets/stays/beimen/day-9.jpg',9),
('beimen','night','assets/stays/beimen/night-1.jpg',10),
('beimen','night','assets/stays/beimen/night-2.jpg',11),
('beimen','night','assets/stays/beimen/night-3.jpg',12),
('beimen','room','assets/stays/beimen/room-1.jpg',13),
('beimen','room','assets/stays/beimen/room-2.jpg',14),
('beimen','room','assets/stays/beimen/room-3.jpg',15),
('beimen','room','assets/stays/beimen/room-4.jpg',16),
('dongmen','day','assets/stays/dongmen/day-1.jpg',1),
('dongmen','day','assets/stays/dongmen/day-2.jpg',2),
('dongmen','day','assets/stays/dongmen/day-3.jpg',3),
('dongmen','day','assets/stays/dongmen/day-4.jpg',4),
('dongmen','day','assets/stays/dongmen/day-5.jpg',5),
('dongmen','day','assets/stays/dongmen/day-6.jpg',6),
('dongmen','day','assets/stays/dongmen/day-7.jpg',7),
('dongmen','room','assets/stays/dongmen/room-1.jpg',8),
('dongmen','room','assets/stays/dongmen/room-2.jpg',9),
('dongmen','room','assets/stays/dongmen/room-3.jpg',10),
('dongmen','room','assets/stays/dongmen/room-4.jpg',11)
) as x(slug,category,url,ord) on x.slug=s.slug
where not exists(select 1 from public.stay_images i where i.stay_id=s.id and i.image_url=x.url);
