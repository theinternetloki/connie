-- Create a database trigger to automatically create a profile when a user signs up
-- This ensures profiles are always created, even if the application code fails

-- Function to create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, dealership_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'dealership_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to call the function when a new user is created
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
