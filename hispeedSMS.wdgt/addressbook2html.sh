#!/bin/sh

# dscl lookup code by Will Harris
HOMEDIR=$(/usr/bin/dscl . -read /users/$USER NFSHomeDirectory | cut -f2 -d' ')
echo '<root>' $(sqlite3 -html "$HOMEDIR/Library/Application Support/AddressBook/AddressBook-v22.abcddb" "SELECT pn.zfullnumber, r.zfirstname, r.zlastname FROM ZABCDPHONENUMBER pn JOIN ZABCDRECORD r ON pn.zowner = r.z_pk WHERE pn.zlabel LIKE '%<Mobile>%' ORDER by r.zfirstname, r.zlastname;") '</root>' | xsltproc addressbooktable2html.xslt -

