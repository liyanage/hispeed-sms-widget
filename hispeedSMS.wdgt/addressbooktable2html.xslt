<?xml version="1.0" encoding="utf-8"?>

<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

<xsl:output version="1.0" encoding="utf-8" indent="yes" omit-xml-declaration="yes"/>

<xsl:template match="/root">
	<select id="abook" onchange="AddressBookPick()" onmouseup="AddressBookPick()">
		<option id='label_abook' value=""></option>
		<xsl:apply-templates/>
	</select>
</xsl:template>

<xsl:template match="TR">
	<option value="{TD[1]}"><xsl:value-of select="TD[2]"/><xsl:text> </xsl:text><xsl:value-of select="TD[3]"/> - <xsl:value-of select="TD[1]"/></option>
</xsl:template>

</xsl:stylesheet>
