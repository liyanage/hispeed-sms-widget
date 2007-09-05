<?xml version="1.0" encoding="utf-8"?>

<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

<xsl:output version="1.0" encoding="utf-8" indent="yes" omit-xml-declaration="yes"/>

<xsl:template match="/root">
	<select id="abook" onchange="AddressBookPick()" onmouseup="AddressBookPick()">
		<option id='label_abook' value=""></option>
		<xsl:apply-templates match="plist">
			<xsl:sort select="translate(dict/string[preceding-sibling::key[1] = 'First'], 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')"/>
			<xsl:sort select="translate(dict/string[preceding-sibling::key[1] = 'Last'], 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')"/>
		</xsl:apply-templates>
	</select>
</xsl:template>

<!-- per-person template -->
<xsl:template match="plist[dict/dict/array/string[. = '_$!&lt;Mobile&gt;!$_']]">
	<xsl:apply-templates select="dict/dict/array/string[. = '_$!&lt;Mobile&gt;!$_']"/>
</xsl:template>

<!-- per-mobile-number template -->
<xsl:template match="string">
	<xsl:variable name="index" select="count(preceding-sibling::string) + 1"/>
	<xsl:variable name="number" select="../../array[preceding-sibling::key[1] = 'values']/string[$index]"/>
	<xsl:variable name="firstname" select="../../../string[preceding-sibling::key[1] = 'First']"/>
	<xsl:variable name="lastname" select="../../../string[preceding-sibling::key[1] = 'Last']"/>
	<option value="{$number}" xml:space="preserve"><xsl:value-of select="$firstname"/> <xsl:value-of select="$lastname"/> - <xsl:value-of select="$number"/></option>
</xsl:template>

<xsl:template match="*"/>

</xsl:stylesheet>
