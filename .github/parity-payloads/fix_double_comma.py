from pathlib import Path
p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
t = p.read_text()
old = "onSearch: (String) -> Unit,,"
if old in t:
    t = t.replace(old, "onSearch: (String) -> Unit,")
    p.write_text(t)
    print("fixed double comma")
else:
    print("no double comma found")
# also ensure browseMode line is clean
t = p.read_text()
if "Unit,,\n    browseMode" in t:
    t = t.replace("Unit,,\n    browseMode", "Unit,\n    browseMode")
    p.write_text(t)
    print("fixed unit comma")
print("ok")
